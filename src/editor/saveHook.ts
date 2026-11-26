import { App, Editor, EditorPosition, MarkdownView } from "obsidian";
import { formatMarkdown } from "../linter";
import { FmatterSettings } from "../types";

interface ObsidianCommand {
	id: string;
	name: string;
	callback?: () => unknown;
	checkCallback?: (checking: boolean) => boolean | void;
}

interface AppWithCommands extends App {
	commands?: {
		commands?: Record<string, ObsidianCommand>;
	};
}

export class SaveHookManager {
	private readonly app: App;
	private readonly getSettings: () => FmatterSettings;
	private readonly formattingKeys = new Set<string>();
	private restoreSaveCommand: (() => void) | null = null;

	constructor(app: App, getSettings: () => FmatterSettings) {
		this.app = app;
		this.getSettings = getSettings;
	}

	/**
	 * Hook Obsidian's built-in `editor:save-file` command (Ctrl/Cmd + S)
	 * so Markdown linting runs right before manual save, without listening to `vault.modify`.
	 */
	install(): void {
		if (this.restoreSaveCommand) {
			return;
		}

		const commands = (this.app as AppWithCommands).commands?.commands;
		const saveCmd = commands?.["editor:save-file"];
		if (!saveCmd) {
			return;
		}

		const originalCheckCallback = saveCmd.checkCallback;
		const originalCallback = saveCmd.callback;

		if (originalCheckCallback) {
			saveCmd.checkCallback = (checking: boolean) => {
				if (!checking) {
					this.formatActiveMarkdownView();
				}
				return originalCheckCallback.call(saveCmd, checking);
			};
		} else if (originalCallback) {
			saveCmd.callback = () => {
				this.formatActiveMarkdownView();
				return originalCallback.call(saveCmd);
			};
		} else {
			return;
		}

		this.restoreSaveCommand = () => {
			if (originalCheckCallback) {
				saveCmd.checkCallback = originalCheckCallback;
			}
			if (originalCallback) {
				saveCmd.callback = originalCallback;
			}
		};
	}

	/**
	 * Restore the original `editor:save-file` command handler on plugin unload.
	 */
	uninstall(): void {
		if (this.restoreSaveCommand) {
			this.restoreSaveCommand();
			this.restoreSaveCommand = null;
		}
		this.formattingKeys.clear();
	}

	/**
	 * Format the currently active MarkdownView editor while preserving cursor and scroll viewport.
	 * Returns true if the document was modified.
	 */
	formatActiveMarkdownView(): boolean {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) {
			return false;
		}
		return this.formatEditor(view.editor, view.file?.path ?? "__active_editor__");
	}

	formatEditor(editor: Editor, lockKey: string): boolean {
		if (this.formattingKeys.has(lockKey)) {
			return false;
		}

		this.formattingKeys.add(lockKey);
		try {
			const original = editor.getValue();
			const settings = this.getSettings();
			const formatted = formatMarkdown(original, settings.linter);

			if (formatted === original) {
				return false;
			}

			applyFormattedTextPreservingViewport(editor, original, formatted);
			return true;
		} finally {
			this.formattingKeys.delete(lockKey);
		}
	}
}

/**
 * Apply minimal prefix/suffix diff range via Editor.replaceRange so Undo history is preserved
 * and cursor / scroll viewport stay stable without jumping.
 */
function applyFormattedTextPreservingViewport(
	editor: Editor,
	original: string,
	formatted: string
): void {
	const scrollInfo = editor.getScrollInfo();
	const cursorPos = editor.getCursor();
	const cursorOffset = editor.posToOffset(cursorPos);

	const maxCommon = Math.min(original.length, formatted.length);
	let prefixLen = 0;
	while (prefixLen < maxCommon && original.charCodeAt(prefixLen) === formatted.charCodeAt(prefixLen)) {
		prefixLen++;
	}

	let suffixLen = 0;
	while (
		suffixLen < maxCommon - prefixLen &&
		original.charCodeAt(original.length - 1 - suffixLen) ===
			formatted.charCodeAt(formatted.length - 1 - suffixLen)
	) {
		suffixLen++;
	}

	const replaceFromOffset = prefixLen;
	const replaceToOffset = original.length - suffixLen;
	const replacementText = formatted.slice(prefixLen, formatted.length - suffixLen);

	const fromPos = editor.offsetToPos(replaceFromOffset);
	const toPos = editor.offsetToPos(replaceToOffset);

	editor.replaceRange(replacementText, fromPos, toPos);

	// Compute stable target cursor position
	let nextCursorPos: EditorPosition;
	if (cursorOffset <= replaceFromOffset) {
		nextCursorPos = cursorPos;
	} else if (cursorOffset >= replaceToOffset) {
		const delta = formatted.length - original.length;
		const shiftedOffset = Math.max(0, Math.min(formatted.length, cursorOffset + delta));
		nextCursorPos = editor.offsetToPos(shiftedOffset);
	} else {
		const clampedLine = Math.min(cursorPos.line, Math.max(0, editor.lineCount() - 1));
		const lineLen = editor.getLine(clampedLine).length;
		nextCursorPos = {
			line: clampedLine,
			ch: Math.min(cursorPos.ch, lineLen),
		};
	}

	editor.setCursor(nextCursorPos);

	window.requestAnimationFrame(() => {
		editor.scrollTo(scrollInfo.left, scrollInfo.top);
	});
}
