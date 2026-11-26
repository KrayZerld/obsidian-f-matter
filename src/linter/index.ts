import { LinterSettings } from "../types";
import { parseBlocks } from "./parser";
import { applyAutoBlankLine } from "./rules/autoBlankLine";
import { applyAutoSpacing } from "./rules/autoSpacing";
import { applyTableAlign } from "./rules/tableAlign";

/**
 * Format a Markdown document according to enabled Linter settings.
 *
 * Two-pass pipeline:
 * - Pass 1 (Protected-zone aware): Auto spacing (fixes headings, list markers, checkboxes, trailing spaces)
 *   so newly fixed headings/lists are recognized accurately as blocks in Pass 2.
 * - Pass 2 (Full block state machine): Parse blocks -> Table alignment -> Auto blank lines.
 */
export function formatMarkdown(content: string, options: LinterSettings): string {
	if (!options.autoBlankLine && !options.autoSpacing && !options.tableAlign) {
		return content;
	}

	// Normalize CRLF -> LF internally for consistent parsing
	const hadTrailingNewline = content.endsWith("\n");
	const normalized = content.replace(/\r\n/g, "\n");
	let lines = normalized.split("\n");

	// Avoid phantom trailing empty line caused by split("\n") on trailing "\n"
	if (hadTrailingNewline && lines.length > 0 && lines[lines.length - 1] === "") {
		lines = lines.slice(0, -1);
	}

	// Pass 1: Auto Spacing
	if (options.autoSpacing) {
		lines = applyAutoSpacing(lines);
	}

	// Pass 2: Block-level parse -> Table Align -> Auto Blank Line
	let blocks = parseBlocks(lines);

	if (options.tableAlign) {
		blocks = applyTableAlign(blocks);
	}

	if (options.autoBlankLine) {
		return applyAutoBlankLine(blocks);
	}

	// Auto blank line disabled: reassemble blocks verbatim while preserving original trailing newline state
	const joined = blocks.flatMap((b) => b.lines).join("\n");
	return hadTrailingNewline ? `${joined}\n` : joined;
}
