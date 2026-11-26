import { Block, BlockType, isBlankLine } from "../parser";

const SURROUNDED_BLOCK_TYPES = new Set<BlockType>([
	"frontmatter",
	"blockquote",
	"code_fence",
	"hr",
	"math_block",
	"table",
	"heading",
	"list",
]);

/**
 * Apply auto blank-line normalization to parsed blocks:
 * 1. Delete all blank lines before Frontmatter (and any leading blank lines before document start).
 * 2. Delete all blank lines inside Frontmatter YAML block.
 * 3. Ensure at least one blank line before and after block-level elements
 *    (blockquote/callout, code_fence, hr, math_block, table, heading, list/checklist, frontmatter).
 * 4. Compact blank lines inside list / checklist blocks (while preserving nested code/math blocks).
 * 5. Collapse 2+ consecutive blank lines in document body into a single blank line.
 * 6. Ensure exactly one trailing newline at EOF (handled by join + single trailing "\n").
 */
export function applyAutoBlankLine(blocks: Block[]): string {
	// Step 1: Collect non-blank blocks while remembering whether a blank existed between adjacent blocks
	const entries: Array<{ block: Block; hadBlankBefore: boolean }> = [];
	let pendingBlank = false;

	for (const block of blocks) {
		if (block.type === "blank") {
			pendingBlank = true;
			continue;
		}
		entries.push({
			block: normalizeSingleBlock(block),
			hadBlankBefore: pendingBlank,
		});
		pendingBlank = false;
	}

	if (entries.length === 0) {
		return "";
	}

	const outputLines: string[] = [];

	for (let i = 0; i < entries.length; i++) {
		const { block, hadBlankBefore } = entries[i];

		if (i > 0) {
			const prevBlock = entries[i - 1].block;
			const needsBlank =
				hadBlankBefore ||
				SURROUNDED_BLOCK_TYPES.has(prevBlock.type) ||
				SURROUNDED_BLOCK_TYPES.has(block.type);

			if (needsBlank) {
				outputLines.push("");
			}
		}

		outputLines.push(...block.lines);
	}

	// Ensure exactly one trailing newline at EOF without extra trailing blank lines
	return `${outputLines.join("\n")}\n`;
}

function normalizeSingleBlock(block: Block): Block {
	// Rule 2: Strip blank lines inside Frontmatter YAML block
	if (block.type === "frontmatter") {
		const cleaned = block.lines.filter((line) => !isBlankLine(line));
		return { ...block, lines: cleaned };
	}

	// Rule 4: Compact blank lines inside list / checklist blocks, keeping nested protected code/math intact
	if (block.type === "list") {
		const mask = block.protectedLineMask;
		const compacted = block.lines.filter((line, idx) => {
			if (mask && mask[idx]) {
				return true;
			}
			return !isBlankLine(line);
		});
		return { ...block, lines: compacted };
	}

	// Code fences, math blocks, blockquotes, tables, headings, hr, paragraphs remain intact internally
	return block;
}
