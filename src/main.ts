import { MarkdownView, Plugin } from "obsidian";
import { NewFileAutomation } from "./automation/newFileHandler";
import { SaveHookManager } from "./editor/saveHook";
import { DEFAULT_SETTINGS, FmatterSettings } from "./types";
import { FmatterSettingTab } from "./ui/SettingTab";

export default class FmatterPlugin extends Plugin {
	settings: FmatterSettings = DEFAULT_SETTINGS;
	private saveHookManager: SaveHookManager | null = null;
	private newFileAutomation: NewFileAutomation | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();

		// 1. Linter save hook (`editor:save-file`) and manual command
		this.saveHookManager = new SaveHookManager(this.app, () => this.settings);
		this.saveHookManager.install();

		this.addCommand({
			id: "format-current-file",
			name: "Format current file",
			editorCheckCallback: (checking, editor, ctx) => {
				if (!(ctx instanceof MarkdownView)) {
					return false;
				}
				if (!checking) {
					this.saveHookManager?.formatEditor(
						editor,
						ctx.file?.path ?? "__manual_format__"
					);
				}
				return true;
			},
		});

		// 2. New file automation (registered safely inside workspace.onLayoutReady)
		this.newFileAutomation = new NewFileAutomation(this.app, () => this.settings);
		this.newFileAutomation.start((eventRef) => this.registerEvent(eventRef));

		// 3. Settings Tab
		this.addSettingTab(new FmatterSettingTab(this.app, this));
	}

	onunload(): void {
		this.saveHookManager?.uninstall();
		this.saveHookManager = null;

		this.newFileAutomation?.dispose();
		this.newFileAutomation = null;
	}

	async loadSettings(): Promise<void> {
		const loaded = (await this.loadData()) as Partial<FmatterSettings> | null;
		this.settings = {
			linter: {
				...DEFAULT_SETTINGS.linter,
				...(loaded?.linter ?? {}),
			},
			frontmatterMappings: Array.isArray(loaded?.frontmatterMappings)
				? loaded.frontmatterMappings
				: [],
			timestampFormat:
				typeof loaded?.timestampFormat === "string"
					? loaded.timestampFormat
					: DEFAULT_SETTINGS.timestampFormat,
		};
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
