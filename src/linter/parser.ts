export type BlockType =
	| "frontmatter"
	| "code_fence"
	| "math_block"
	| "blockquote"
	| "hr"
	| "heading"
	| "table"
	| "list"
	| "paragraph"
	| "blank";

export interface Block {
	type: BlockType;
	lines: string[];
	/** For list blocks: marks lines inside nested fenced code/math blocks so blank lines inside them remain untouched */
	protectedLineMask?: boolean[];
}

export type LineProtection = "normal" | "frontmatter" | "code_fence" | "math_block";

export interface FenceInfo {
	char: "`" | "~";
	length: number;
	blockquoteDepth: number;
}

export function isBlankLine(line: string): boolean {
	return /^[ \t]*$/.test(line);
}

export function isHorizontalRule(line: string): boolean {
	return /^[ \t]{0,3}((\*[ \t]*){3,}|(-[ \t]*){3,}|(_[ \t]*){3,})$/.test(line);
}

export function isHeadingLine(line: string): boolean {
	return /^[ \t]{0,3}#{1,6}(?:[ \t]+.*|[ \t]*)$/.test(line);
}

export function isBlockquoteLine(line: string): boolean {
	return /^[ \t]{0,3}>/.test(line);
}

export type ListKind = "unordered" | "ordered";

export function matchListItem(line: string): { indent: number; kind: ListKind } | null {
	if (isHorizontalRule(line)) {
		return null;
	}
	const unordered = /^([ \t]*)[-*+][ \t]+/.exec(line);
	if (unordered) {
		return { indent: getIndentColumns(unordered[1]), kind: "unordered" };
	}
	const ordered = /^([ \t]*)\d+[.)][ \t]+/.exec(line);
	if (ordered) {
		return { indent: getIndentColumns(ordered[1]), kind: "ordered" };
	}
	return null;
}

function getIndentColumns(indentStr: string): number {
	let cols = 0;
	for (const ch of indentStr) {
		cols += ch === "\t" ? 4 : 1;
	}
	return cols;
}

/**
 * Match a fenced code opener (``` or ~~~), optionally nested inside blockquote prefix (>).
 * Rejects inline backtick spans such as ```code``` because CommonMark forbids backticks in backtick info strings.
 */
export function matchCodeFenceOpen(line: string, allowDeepIndent = false): FenceInfo | null {
	const { depth, rest } = stripBlockquotePrefix(line);
	const indentPattern = allowDeepIndent ? "[ \\t]*" : "[ \\t]{0,3}";

	const backtickRegex = new RegExp(`^${indentPattern}(\`{3,})([^\`]*)$`);
	const backtickMatch = backtickRegex.exec(rest);
	if (backtickMatch) {
		return {
			char: "`",
			length: backtickMatch[1].length,
			blockquoteDepth: depth,
		};
	}

	const tildeRegex = new RegExp(`^${indentPattern}(~{3,})(.*)$`);
	const tildeMatch = tildeRegex.exec(rest);
	if (tildeMatch) {
		return {
			char: "~",
			length: tildeMatch[1].length,
			blockquoteDepth: depth,
		};
	}

	return null;
}

export function isCodeFenceClose(line: string, fence: FenceInfo): boolean {
	const { depth, rest } = stripBlockquotePrefix(line);
	if (fence.blockquoteDepth > 0 && depth < fence.blockquoteDepth) {
		return false;
	}
	const escapedChar = fence.char === "`" ? "`" : "~";
	const closeRegex = new RegExp(`^[ \\t]*${escapedChar}{${fence.length},}[ \\t]*$`);
	return closeRegex.test(rest);
}

function stripBlockquotePrefix(line: string): { depth: number; rest: string } {
	let depth = 0;
	let rest = line;
	while (true) {
		const m = /^[ \t]{0,3}>[ \t]?(.*)$/.exec(rest);
		if (!m) {
			break;
		}
		depth++;
		rest = m[1];
	}
	return { depth, rest };
}

export function isSingleLineMathBlock(line: string): boolean {
	const trimmed = line.trim();
	return trimmed.length >= 4 && trimmed.startsWith("$$") && trimmed.endsWith("$$");
}

export function isMultiLineMathOpen(line: string): boolean {
	const trimmed = line.trim();
	if (!trimmed.startsWith("$$")) {
		return false;
	}
	// If it closes on the same line, it is a single-line math block instead
	return !isSingleLineMathBlock(line);
}

export function isMultiLineMathClose(line: string): boolean {
	return line.trim().endsWith("$$");
}

/**
 * Detect YAML frontmatter starting at the first non-blank line of the document.
 * Returns the inclusive [startIndex, endIndex] if a valid closing delimiter exists, otherwise null.
 */
export function findFrontmatterRange(lines: string[]): [number, number] | null {
	let start = 0;
	while (start < lines.length && isBlankLine(lines[start])) {
		start++;
	}
	if (start >= lines.length) {
		return null;
	}
	if (!/^---[ \t]*$/.test(lines[start])) {
		return null;
	}
	for (let i = start + 1; i < lines.length; i++) {
		if (/^(---|\.\.\.)[ \t]*$/.test(lines[i])) {
			return [start, i];
		}
	}
	return null;
}

/**
 * Split a Markdown table row into raw trimmed cells, respecting escaped pipes (\|)
 * and inline code spans (`...` or ``...``).
 */
export function splitTableCells(line: string): string[] | null {
	const trimmed = line.trim();
	if (!trimmed || !containsUnescapedPipeOutsideCode(trimmed)) {
		return null;
	}

	let inner = trimmed;
	if (inner.startsWith("|")) {
		inner = inner.slice(1);
	}
	if (endsWithUnescapedPipe(inner)) {
		inner = inner.slice(0, -1);
	}

	const cells: string[] = [];
	let current = "";
	let i = 0;

	while (i < inner.length) {
		const ch = inner[i];

		// Escaped character outside code span
		if (ch === "\\" && i + 1 < inner.length) {
			current += ch + inner[i + 1];
			i += 2;
			continue;
		}

		// Inline code span
		if (ch === "`") {
			let tickLen = 1;
			while (i + tickLen < inner.length && inner[i + tickLen] === "`") {
				tickLen++;
			}
			const delimiter = "`".repeat(tickLen);
			const closeIdx = findClosingBackticks(inner, i + tickLen, tickLen);
			if (closeIdx !== -1) {
				current += inner.slice(i, closeIdx + tickLen);
				i = closeIdx + tickLen;
				continue;
			}
			// No matching closer: treat ticks as literal text
			current += delimiter;
			i += tickLen;
			continue;
		}

		if (ch === "|") {
			cells.push(current.trim());
			current = "";
			i++;
			continue;
		}

		current += ch;
		i++;
	}

	cells.push(current.trim());
	return cells;
}

function findClosingBackticks(str: string, fromIndex: number, tickLen: number): number {
	let i = fromIndex;
	while (i < str.length) {
		if (str[i] === "`") {
			let run = 1;
			while (i + run < str.length && str[i + run] === "`") {
				run++;
			}
			if (run === tickLen) {
				return i;
			}
			i += run;
		} else {
			i++;
		}
	}
	return -1;
}

function endsWithUnescapedPipe(str: string): boolean {
	if (!str.endsWith("|")) {
		return false;
	}
	let backslashes = 0;
	for (let i = str.length - 2; i >= 0 && str[i] === "\\"; i--) {
		backslashes++;
	}
	return backslashes % 2 === 0;
}

export function containsUnescapedPipeOutsideCode(line: string): boolean {
	let i = 0;
	while (i < line.length) {
		const ch = line[i];
		if (ch === "\\" && i + 1 < line.length) {
			i += 2;
			continue;
		}
		if (ch === "`") {
			let tickLen = 1;
			while (i + tickLen < line.length && line[i + tickLen] === "`") {
				tickLen++;
			}
			const closeIdx = findClosingBackticks(line, i + tickLen, tickLen);
			if (closeIdx !== -1) {
				i = closeIdx + tickLen;
				continue;
			}
			i += tickLen;
			continue;
		}
		if (ch === "|") {
			return true;
		}
		i++;
	}
	return false;
}

export function isTableDelimiterRow(line: string): boolean {
	if (isBlockquoteLine(line)) {
		return false;
	}
	const cells = splitTableCells(line);
	if (!cells || cells.length === 0) {
		return false;
	}
	return cells.every((cell) => /^:?-+:?$/.test(cell));
}

export function isTableStart(lines: string[], index: number): boolean {
	if (index + 1 >= lines.length) {
		return false;
	}
	const headerLine = lines[index];
	const delimLine = lines[index + 1];

	if (isBlankLine(headerLine) || isBlockquoteLine(headerLine) || isHorizontalRule(headerLine)) {
		return false;
	}
	if (!containsUnescapedPipeOutsideCode(headerLine)) {
		return false;
	}
	return isTableDelimiterRow(delimLine);
}

/**
 * Pass 1 helper: classify each line's protection status so auto-spacing never touches
 * Frontmatter, fenced code blocks (including indented/quoted code fences), or math blocks.
 */
export function parseProtectedLineKinds(lines: string[]): LineProtection[] {
	const kinds: LineProtection[] = new Array(lines.length).fill("normal");
	const fmRange = findFrontmatterRange(lines);
	let i = 0;

	if (fmRange) {
		const [fmStart, fmEnd] = fmRange;
		for (let k = fmStart; k <= fmEnd; k++) {
			kinds[k] = "frontmatter";
		}
		i = fmEnd + 1;
	}

	let activeFence: FenceInfo | null = null;
	let inMath = false;

	for (; i < lines.length; i++) {
		const line = lines[i];

		if (activeFence) {
			// If a quoted fence loses its blockquote prefix, close the fence before classifying this line
			if (activeFence.blockquoteDepth > 0 && !isBlockquoteLine(line)) {
				activeFence = null;
			} else {
				kinds[i] = "code_fence";
				if (isCodeFenceClose(line, activeFence)) {
					activeFence = null;
				}
				continue;
			}
		}

		if (inMath) {
			kinds[i] = "math_block";
			if (isMultiLineMathClose(line)) {
				inMath = false;
			}
			continue;
		}

		const fenceOpen = matchCodeFenceOpen(line, true);
		if (fenceOpen) {
			kinds[i] = "code_fence";
			activeFence = fenceOpen;
			continue;
		}

		if (isSingleLineMathBlock(line)) {
			kinds[i] = "math_block";
			continue;
		}

		if (isMultiLineMathOpen(line)) {
			kinds[i] = "math_block";
			inMath = true;
			continue;
		}
	}

	return kinds;
}

/**
 * Pass 2: Full block-level state machine parser.
 */
export function parseBlocks(lines: string[]): Block[] {
	const blocks: Block[] = [];
	const fmRange = findFrontmatterRange(lines);
	let i = 0;

	if (fmRange) {
		const [fmStart, fmEnd] = fmRange;
		if (fmStart > 0) {
			blocks.push({ type: "blank", lines: lines.slice(0, fmStart) });
		}
		blocks.push({ type: "frontmatter", lines: lines.slice(fmStart, fmEnd + 1) });
		i = fmEnd + 1;
	}

	while (i < lines.length) {
		const line = lines[i];

		// 1. Blank lines
		if (isBlankLine(line)) {
			const start = i;
			while (i < lines.length && isBlankLine(lines[i])) {
				i++;
			}
			blocks.push({ type: "blank", lines: lines.slice(start, i) });
			continue;
		}

		// 2. Top-level fenced code block
		const fenceOpen = matchCodeFenceOpen(line, false);
		if (fenceOpen && fenceOpen.blockquoteDepth === 0) {
			const start = i;
			i++;
			while (i < lines.length) {
				const close = isCodeFenceClose(lines[i], fenceOpen);
				i++;
				if (close) {
					break;
				}
			}
			blocks.push({ type: "code_fence", lines: lines.slice(start, i) });
			continue;
		}

		// 3. Block-level LaTeX math
		if (isSingleLineMathBlock(line)) {
			blocks.push({ type: "math_block", lines: [line] });
			i++;
			continue;
		}
		if (isMultiLineMathOpen(line)) {
			const start = i;
			i++;
			while (i < lines.length) {
				const close = isMultiLineMathClose(lines[i]);
				i++;
				if (close) {
					break;
				}
			}
			blocks.push({ type: "math_block", lines: lines.slice(start, i) });
			continue;
		}

		// 4. Blockquote / Callout
		if (isBlockquoteLine(line)) {
			const start = i;
			while (i < lines.length && isBlockquoteLine(lines[i])) {
				i++;
			}
			blocks.push({ type: "blockquote", lines: lines.slice(start, i) });
			continue;
		}

		// 5. Horizontal rule (must check before list)
		if (isHorizontalRule(line)) {
			blocks.push({ type: "hr", lines: [line] });
			i++;
			continue;
		}

		// 6. ATX Heading
		if (isHeadingLine(line)) {
			blocks.push({ type: "heading", lines: [line] });
			i++;
			continue;
		}

		// 7. Markdown Table
		if (isTableStart(lines, i)) {
			const start = i;
			i += 2; // Header + delimiter
			while (
				i < lines.length &&
				!isBlankLine(lines[i]) &&
				!isBlockquoteLine(lines[i]) &&
				!isHorizontalRule(lines[i]) &&
				!isHeadingLine(lines[i]) &&
				!matchCodeFenceOpen(lines[i], false) &&
				!isSingleLineMathBlock(lines[i]) &&
				!isMultiLineMathOpen(lines[i]) &&
				!matchListItem(lines[i]) &&
				containsUnescapedPipeOutsideCode(lines[i])
			) {
				i++;
			}
			blocks.push({ type: "table", lines: lines.slice(start, i) });
			continue;
		}

		// 8. List / CheckList block (with loose-list blank lookahead and nested fence protection)
		const firstListItem = matchListItem(line);
		if (firstListItem) {
			const { block, nextIndex } = consumeListBlock(lines, i, firstListItem.kind);
			blocks.push(block);
			i = nextIndex;
			continue;
		}

		// 9. Paragraph
		const start = i;
		i++;
		while (i < lines.length && !isNonParagraphStart(lines, i)) {
			i++;
		}
		blocks.push({ type: "paragraph", lines: lines.slice(start, i) });
	}

	return blocks;
}

function isNonParagraphStart(lines: string[], index: number): boolean {
	const line = lines[index];
	if (
		isBlankLine(line) ||
		isBlockquoteLine(line) ||
		isHorizontalRule(line) ||
		isHeadingLine(line) ||
		isSingleLineMathBlock(line) ||
		isMultiLineMathOpen(line) ||
		matchListItem(line) !== null ||
		isTableStart(lines, index)
	) {
		return true;
	}
	const fence = matchCodeFenceOpen(line, false);
	return fence !== null && fence.blockquoteDepth === 0;
}

function consumeListBlock(
	lines: string[],
	startIndex: number,
	rootKind: ListKind
): { block: Block; nextIndex: number } {
	const listLines: string[] = [];
	const protectedMask: boolean[] = [];
	let i = startIndex;
	let nestedFence: FenceInfo | null = null;
	let nestedMath = false;

	while (i < lines.length) {
		const line = lines[i];

		// Inside nested code fence or math block inside list item
		if (nestedFence) {
			listLines.push(line);
			protectedMask.push(true);
			if (isCodeFenceClose(line, nestedFence)) {
				nestedFence = null;
			}
			i++;
			continue;
		}
		if (nestedMath) {
			listLines.push(line);
			protectedMask.push(true);
			if (isMultiLineMathClose(line)) {
				nestedMath = false;
			}
			i++;
			continue;
		}

		// Blank lines inside a list: look ahead to see if the same list continues
		if (isBlankLine(line)) {
			let lookahead = i;
			while (lookahead < lines.length && isBlankLine(lines[lookahead])) {
				lookahead++;
			}
			if (lookahead >= lines.length) {
				break;
			}
			const nextLine = lines[lookahead];
			const nextItem = matchListItem(nextLine);
			const continuesSameList =
				(nextItem !== null && (nextItem.indent > 0 || nextItem.kind === rootKind)) ||
				isIndentedListContinuation(nextLine);

			if (!continuesSameList) {
				break;
			}

			// Consume the intermediate blank lines as part of the list block
			for (let k = i; k < lookahead; k++) {
				listLines.push(lines[k]);
				protectedMask.push(false);
			}
			i = lookahead;
			continue;
		}

		// Direct list item
		const item = matchListItem(line);
		if (item) {
			// If top-level list switches kind without blank line (e.g., `- a` followed immediately by `1. b`),
			// start a separate block so mixed lists stay well-structured.
			if (i > startIndex && item.indent === 0 && item.kind !== rootKind) {
				break;
			}
			listLines.push(line);
			protectedMask.push(false);
			i++;
			continue;
		}

		// Indented continuation line (could open a nested fenced code or math block)
		if (isIndentedListContinuation(line)) {
			const fence = matchCodeFenceOpen(line, true);
			if (fence && fence.blockquoteDepth === 0) {
				listLines.push(line);
				protectedMask.push(true);
				nestedFence = fence;
				i++;
				continue;
			}
			if (isSingleLineMathBlock(line)) {
				listLines.push(line);
				protectedMask.push(true);
				i++;
				continue;
			}
			if (isMultiLineMathOpen(line)) {
				listLines.push(line);
				protectedMask.push(true);
				nestedMath = true;
				i++;
				continue;
			}
			listLines.push(line);
			protectedMask.push(false);
			i++;
			continue;
		}

		// Non-indented, non-list line terminates the list block
		break;
	}

	return {
		block: {
			type: "list",
			lines: listLines,
			protectedLineMask: protectedMask,
		},
		nextIndex: i,
	};
}

function isIndentedListContinuation(line: string): boolean {
	if (!/^(?:[ ]{2,}|\t)/.test(line)) {
		return false;
	}
	// Do not swallow top-level headings/hr/blockquotes with 2-3 spaces indent
	if (isHorizontalRule(line) || isHeadingLine(line) || isBlockquoteLine(line)) {
		return false;
	}
	return true;
}
