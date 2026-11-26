import { Block, splitTableCells } from "../parser";
import { getDisplayWidth } from "../width";

type ColumnAlign = "none" | "left" | "center" | "right";

/**
 * Format all Markdown `table` blocks with CJK-aware monospace width alignment.
 * Non-table blocks (including fenced code blocks) are passed through untouched.
 */
export function applyTableAlign(blocks: Block[]): Block[] {
	return blocks.map((block) => {
		if (block.type !== "table") {
			return block;
		}
		return {
			...block,
			lines: formatTableLines(block.lines),
		};
	});
}

export function formatTableLines(lines: string[]): string[] {
	if (lines.length < 2) {
		return lines;
	}

	const headerCells = splitTableCells(lines[0]);
	const delimCells = splitTableCells(lines[1]);
	if (!headerCells || !delimCells) {
		return lines;
	}

	const alignments: ColumnAlign[] = [];
	for (const cell of delimCells) {
		const align = parseAlignment(cell);
		if (!align) {
			return lines;
		}
		alignments.push(align);
	}

	const bodyRows: string[][] = [];
	for (let i = 2; i < lines.length; i++) {
		const cells = splitTableCells(lines[i]);
		if (!cells) {
			return lines;
		}
		bodyRows.push(cells);
	}

	// Determine unified column count across header, delimiter, and all body rows
	let colCount = Math.max(headerCells.length, alignments.length);
	for (const row of bodyRows) {
		if (row.length > colCount) {
			colCount = row.length;
		}
	}

	const normalizedHeader = padRowLength(headerCells, colCount);
	const normalizedAlignments = padAlignLength(alignments, colCount);
	const normalizedBody = bodyRows.map((row) => padRowLength(row, colCount));

	// Compute max monospace display width per column (minimum 3 for readable delimiter `---`)
	const colWidths = new Array<number>(colCount).fill(3);
	for (let c = 0; c < colCount; c++) {
		colWidths[c] = Math.max(colWidths[c], getDisplayWidth(normalizedHeader[c]));
		for (const row of normalizedBody) {
			colWidths[c] = Math.max(colWidths[c], getDisplayWidth(row[c]));
		}
	}

	const formatted: string[] = [];
	formatted.push(renderDataRow(normalizedHeader, colWidths, normalizedAlignments));
	formatted.push(renderDelimiterRow(colWidths, normalizedAlignments));
	for (const row of normalizedBody) {
		formatted.push(renderDataRow(row, colWidths, normalizedAlignments));
	}

	return formatted;
}

function parseAlignment(cell: string): ColumnAlign | null {
	if (!/^:?-+:?$/.test(cell)) {
		return null;
	}
	const left = cell.startsWith(":");
	const right = cell.endsWith(":");
	if (left && right) {
		return "center";
	}
	if (left) {
		return "left";
	}
	if (right) {
		return "right";
	}
	return "none";
}

function padRowLength(row: string[], colCount: number): string[] {
	if (row.length >= colCount) {
		return row.slice(0, colCount);
	}
	return [...row, ...new Array<string>(colCount - row.length).fill("")];
}

function padAlignLength(aligns: ColumnAlign[], colCount: number): ColumnAlign[] {
	if (aligns.length >= colCount) {
		return aligns.slice(0, colCount);
	}
	return [...aligns, ...new Array<ColumnAlign>(colCount - aligns.length).fill("none")];
}

function renderDataRow(cells: string[], colWidths: number[], alignments: ColumnAlign[]): string {
	const parts = cells.map((cell, c) => padCell(cell, colWidths[c], alignments[c]));
	return `| ${parts.join(" | ")} |`;
}

function renderDelimiterRow(colWidths: number[], alignments: ColumnAlign[]): string {
	const parts = colWidths.map((width, c) => {
		const align = alignments[c];
		if (align === "center") {
			return `:${"-".repeat(Math.max(1, width - 2))}:`;
		}
		if (align === "left") {
			return `:${"-".repeat(Math.max(2, width - 1))}`;
		}
		if (align === "right") {
			return `${"-".repeat(Math.max(2, width - 1))}:`;
		}
		return "-".repeat(Math.max(3, width));
	});
	return `| ${parts.join(" | ")} |`;
}

function padCell(cell: string, targetWidth: number, align: ColumnAlign): string {
	const width = getDisplayWidth(cell);
	const diff = Math.max(0, targetWidth - width);

	if (align === "right") {
		return `${" ".repeat(diff)}${cell}`;
	}
	if (align === "center") {
		const leftPad = Math.floor(diff / 2);
		const rightPad = diff - leftPad;
		return `${" ".repeat(leftPad)}${cell}${" ".repeat(rightPad)}`;
	}
	return `${cell}${" ".repeat(diff)}`;
}
