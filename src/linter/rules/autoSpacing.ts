import { isHorizontalRule, parseProtectedLineKinds } from "../parser";

const CJK_CHAR_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const LATIN_OR_DIGIT_RE = /[A-Za-z0-9]/;

const CJK_THEN_ALNUM_RE = /([\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff])([A-Za-z0-9])/g;
const ALNUM_THEN_CJK_RE = /([A-Za-z0-9])([\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff])/g;

/**
 * Apply auto-spacing rules to non-protected lines (skips Frontmatter, fenced code blocks, and math blocks):
 * 1. ATX Heading spacing: `##`..`######` followed directly by non-space -> insert one space.
 *    Single `#` without space (Obsidian `#tag`) is intentionally preserved untouched.
 * 2. List marker spacing: `-` / `*` / `+` / `1.` without space -> insert one space
 *    (safely excludes horizontal rules, emphasis like `*italic*` / `**bold**`, and decimal numbers like `1.5`).
 * 3. Checkbox spacing: `- [ ]task` / `- [x]task` (and missing space between `-` and `[ ]`) -> insert space.
 * 4. CJK-English/Digit spacing (Pangu style): insert a space between CJK ideographs (excluding punctuation)
 *    and ASCII letters/digits `[A-Za-z0-9]`, while protecting inline code, inline math, URLs, links,
 *    WikiLinks, HTML tags, and `#tag`s, and spacing boundaries of inline code/math and Latin/digit emphasis.
 * 5. Trailing whitespace removal: strip trailing spaces and tabs on every non-protected line.
 */
export function applyAutoSpacing(lines: string[]): string[] {
	const protection = parseProtectedLineKinds(lines);

	return lines.map((line, index) => {
		if (protection[index] !== "normal") {
			return line;
		}
		return formatLineSpacing(line);
	});
}

function formatLineSpacing(rawLine: string): string {
	// Strip trailing spaces and tabs first
	let line = rawLine.replace(/[ \t]+$/, "");
	if (line.length === 0) {
		return line;
	}

	// Preserve horizontal rules as-is
	if (isHorizontalRule(line)) {
		return line;
	}

	// Step A: Line-start Markdown structural spacing (headings, checkboxes, list markers)
	line = applyStructuralLineSpacing(line);

	// Step B: Inline CJK <-> English/Digit spacing with inline Markdown syntax protection
	line = applyCjkInlineSpacing(line);

	return line.replace(/[ \t]+$/, "");
}

function applyStructuralLineSpacing(line: string): string {
	// 1. Heading spacing: strictly ## ~ ###### without space; single # preserved as Obsidian #tag
	const headingMatch = /^([ \t]{0,3})(#{2,6})([^#\s].*)$/.exec(line);
	if (headingMatch) {
		return `${headingMatch[1]}${headingMatch[2]} ${headingMatch[3]}`;
	}

	// 2. Checkbox spacing (handle both `-[ ]task` and `- [ ]task`)
	const unorderedCheckboxMatch = /^([ \t]*)([-*+])[ \t]*(\[[ xX]\])([^\s].*)$/.exec(line);
	if (unorderedCheckboxMatch) {
		return `${unorderedCheckboxMatch[1]}${unorderedCheckboxMatch[2]} ${unorderedCheckboxMatch[3]} ${unorderedCheckboxMatch[4]}`;
	}
	const unorderedCheckboxMarkerOnly = /^([ \t]*)([-*+])(\[[ xX]\])([ \t].*|$)/.exec(line);
	if (unorderedCheckboxMarkerOnly) {
		return `${unorderedCheckboxMarkerOnly[1]}${unorderedCheckboxMarkerOnly[2]} ${unorderedCheckboxMarkerOnly[3]}${unorderedCheckboxMarkerOnly[4]}`;
	}

	const orderedCheckboxMatch = /^([ \t]*)(\d+\.)[ \t]*(\[[ xX]\])([^\s].*)$/.exec(line);
	if (orderedCheckboxMatch) {
		return `${orderedCheckboxMatch[1]}${orderedCheckboxMatch[2]} ${orderedCheckboxMatch[3]} ${orderedCheckboxMatch[4]}`;
	}
	const orderedCheckboxMarkerOnly = /^([ \t]*)(\d+\.)(\[[ xX]\])([ \t].*|$)/.exec(line);
	if (orderedCheckboxMarkerOnly) {
		return `${orderedCheckboxMarkerOnly[1]}${orderedCheckboxMarkerOnly[2]} ${orderedCheckboxMarkerOnly[3]}${orderedCheckboxMarkerOnly[4]}`;
	}

	// 3. Unordered list marker spacing
	const dashListMatch = /^([ \t]*)(-)([^\s-].*)$/.exec(line);
	if (dashListMatch) {
		return `${dashListMatch[1]}- ${dashListMatch[3]}`;
	}

	const plusListMatch = /^([ \t]*)(\+)([^\s+].*)$/.exec(line);
	if (plusListMatch) {
		return `${plusListMatch[1]}+ ${plusListMatch[3]}`;
	}

	const starListMatch = /^([ \t]*)(\*)([^\s*].*)$/.exec(line);
	if (starListMatch && !hasClosingAsterisk(starListMatch[3])) {
		return `${starListMatch[1]}* ${starListMatch[3]}`;
	}

	// 4. Ordered list marker spacing (`1.item` -> `1. item`), excluding decimal numbers like `1.5`
	const orderedListMatch = /^([ \t]*)(\d+\.)([^\s\d].*)$/.exec(line);
	if (orderedListMatch) {
		return `${orderedListMatch[1]}${orderedListMatch[2]} ${orderedListMatch[3]}`;
	}

	return line;
}

/**
 * Checks whether the remainder of a `*...` line contains an unescaped closing `*`
 * (outside inline code), indicating Markdown italic emphasis `*text*` rather than a list marker.
 */
function hasClosingAsterisk(rest: string): boolean {
	let inCode = false;
	for (let i = 0; i < rest.length; i++) {
		const ch = rest[i];
		if (ch === "\\" && !inCode && i + 1 < rest.length) {
			i++;
			continue;
		}
		if (ch === "`") {
			inCode = !inCode;
			continue;
		}
		if (!inCode && ch === "*") {
			return true;
		}
	}
	return false;
}

interface InlineToken {
	text: string;
	/** Whether a space should be inserted when immediately preceded by a CJK ideograph */
	spaceBeforeIfCjk: boolean;
	/** Whether a space should be inserted when immediately followed by a CJK ideograph */
	spaceAfterIfCjk: boolean;
	/** Plain text fragment that may itself start/end with CJK or Latin/digit */
	isPlainText: boolean;
}

/**
 * Apply Pangu-style CJK <-> English/Digit spacing across a single Markdown line,
 * protecting inline syntax internals while spacing appropriate boundaries.
 */
export function applyCjkInlineSpacing(line: string): string {
	// Quick bailout if line contains no CJK ideographs at all
	if (!CJK_CHAR_RE.test(line)) {
		return line;
	}

	const tokens = tokenizeInline(line);
	let result = "";

	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];
		if (token.text.length === 0) {
			continue;
		}

		const prevChar = result.length > 0 ? result[result.length - 1] : "";
		const firstChar = token.text[0];

		// Insert space between previous emitted output and current token when needed
		if (prevChar && !isWhitespace(prevChar)) {
			const prevToken = i > 0 ? tokens[i - 1] : null;
			const needSpaceFromPrev =
				prevToken !== null &&
				prevToken.spaceAfterIfCjk &&
				token.isPlainText &&
				isCjkChar(firstChar);
			const needSpaceForCurr = token.spaceBeforeIfCjk && isCjkChar(prevChar);
			const needPlainBoundary =
				token.isPlainText &&
				prevToken !== null &&
				prevToken.isPlainText &&
				((isCjkChar(prevChar) && isLatinOrDigit(firstChar)) ||
					(isLatinOrDigit(prevChar) && isCjkChar(firstChar)));

			if (needSpaceFromPrev || needSpaceForCurr || needPlainBoundary) {
				result += " ";
			}
		}

		result += token.text;
	}

	return result;
}

function tokenizeInline(line: string): InlineToken[] {
	const tokens: InlineToken[] = [];
	let plainBuf = "";
	let i = 0;

	const flushPlain = () => {
		if (plainBuf.length > 0) {
			tokens.push({
				text: spacePlainText(plainBuf),
				spaceBeforeIfCjk: false,
				spaceAfterIfCjk: false,
				isPlainText: true,
			});
			plainBuf = "";
		}
	};

	while (i < line.length) {
		const ch = line[i];

		// 1. Escaped character outside code/math
		if (ch === "\\" && i + 1 < line.length) {
			plainBuf += line.slice(i, i + 2);
			i += 2;
			continue;
		}

		// 2. Inline code span (`...` or ``...``)
		if (ch === "`") {
			let tickLen = 1;
			while (i + tickLen < line.length && line[i + tickLen] === "`") {
				tickLen++;
			}
			const closeIdx = findClosingBackticks(line, i + tickLen, tickLen);
			if (closeIdx !== -1) {
				flushPlain();
				const raw = line.slice(i, closeIdx + tickLen);
				tokens.push({
					text: raw,
					spaceBeforeIfCjk: true,
					spaceAfterIfCjk: true,
					isPlainText: false,
				});
				i = closeIdx + tickLen;
				continue;
			}
		}

		// 3. Inline LaTeX math ($...$, excluding $$ and currency patterns like $100 ... $200)
		if (ch === "$" && line[i + 1] !== "$") {
			const mathEnd = findClosingInlineMath(line, i);
			if (mathEnd !== -1) {
				flushPlain();
				const raw = line.slice(i, mathEnd + 1);
				tokens.push({
					text: raw,
					spaceBeforeIfCjk: true,
					spaceAfterIfCjk: true,
					isPlainText: false,
				});
				i = mathEnd + 1;
				continue;
			}
		}

		// 4. Obsidian WikiLink / Embed (`![[...]]` or `[[...]]`) - protect internals strictly
		if (
			(ch === "!" && line[i + 1] === "[" && line[i + 2] === "[") ||
			(ch === "[" && line[i + 1] === "[")
		) {
			const openLen = ch === "!" ? 3 : 2;
			const closeIdx = line.indexOf("]]", i + openLen);
			if (closeIdx !== -1) {
				flushPlain();
				tokens.push({
					text: line.slice(i, closeIdx + 2),
					spaceBeforeIfCjk: false,
					spaceAfterIfCjk: false,
					isPlainText: false,
				});
				i = closeIdx + 2;
				continue;
			}
		}

		// 5. Markdown Image or Link: `![alt](url)` or `[text](url)`
		if ((ch === "!" && line[i + 1] === "[") || ch === "[") {
			const linkMatch = matchMarkdownLink(line, i);
			if (linkMatch) {
				flushPlain();
				const formattedLabel = applyCjkInlineSpacing(linkMatch.label);
				tokens.push({
					text: `${linkMatch.prefix}[${formattedLabel}](${linkMatch.dest})`,
					spaceBeforeIfCjk: false,
					spaceAfterIfCjk: false,
					isPlainText: false,
				});
				i = linkMatch.endIndex;
				continue;
			}
		}

		// 6. Autolink / HTML tag / HTML comment: `<!-- ... -->` or `<...>`
		if (ch === "<") {
			const htmlMatch = matchHtmlOrAutolink(line, i);
			if (htmlMatch) {
				flushPlain();
				tokens.push({
					text: htmlMatch.raw,
					spaceBeforeIfCjk: false,
					spaceAfterIfCjk: false,
					isPlainText: false,
				});
				i = htmlMatch.endIndex;
				continue;
			}
		}

		// 7. Bare URL (`https://...` / `http://...`)
		if (
			(ch === "h" || ch === "H") &&
			/^https?:\/\//i.test(line.slice(i))
		) {
			const urlMatch = /^https?:\/\/[^\s<>()[\]{}"'`\u3000-\u303f\uff00-\uffef\u4e00-\u9fff]+/i.exec(
				line.slice(i)
			);
			if (urlMatch) {
				flushPlain();
				tokens.push({
					text: urlMatch[0],
					spaceBeforeIfCjk: true,
					spaceAfterIfCjk: true,
					isPlainText: false,
				});
				i += urlMatch[0].length;
				continue;
			}
		}

		// 8. Obsidian Tag (`#tag`, `#中文/English`) at line start or after whitespace
		if (ch === "#" && (i === 0 || isWhitespace(line[i - 1]))) {
			const tagMatch = /^#[\p{L}\p{N}_/-]+/u.exec(line.slice(i));
			if (tagMatch) {
				flushPlain();
				tokens.push({
					text: tagMatch[0],
					spaceBeforeIfCjk: false,
					spaceAfterIfCjk: false,
					isPlainText: false,
				});
				i += tagMatch[0].length;
				continue;
			}
		}

		// 9. Emphasis / Strong (`***...***`, `**...**`, `*...*`)
		if (ch === "*") {
			const emphMatch = matchStarEmphasis(line, i);
			if (emphMatch) {
				flushPlain();
				const innerFormatted = applyCjkInlineSpacing(emphMatch.inner);
				const firstInnerChar = stripLeadingInlineDecorators(innerFormatted)[0] ?? "";
				const lastInnerChar = stripTrailingInlineDecorators(innerFormatted).slice(-1);

				tokens.push({
					text: `${emphMatch.marker}${innerFormatted}${emphMatch.marker}`,
					spaceBeforeIfCjk: isLatinOrDigit(firstInnerChar) || firstInnerChar === "`" || firstInnerChar === "$",
					spaceAfterIfCjk: isLatinOrDigit(lastInnerChar) || lastInnerChar === "`" || lastInnerChar === "$",
					isPlainText: false,
				});
				i = emphMatch.endIndex;
				continue;
			}
		}

		plainBuf += ch;
		i++;
	}

	flushPlain();
	return tokens;
}

function spacePlainText(text: string): string {
	return text
		.replace(CJK_THEN_ALNUM_RE, "$1 $2")
		.replace(ALNUM_THEN_CJK_RE, "$1 $2");
}

function isCjkChar(ch: string): boolean {
	return ch.length > 0 && CJK_CHAR_RE.test(ch);
}

function isLatinOrDigit(ch: string): boolean {
	return ch.length > 0 && LATIN_OR_DIGIT_RE.test(ch);
}

function isWhitespace(ch: string): boolean {
	return ch === " " || ch === "\t";
}

function stripLeadingInlineDecorators(text: string): string {
	return text.replace(/^\*+/, "");
}

function stripTrailingInlineDecorators(text: string): string {
	return text.replace(/\*+$/, "");
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

function findClosingInlineMath(line: string, openIdx: number): number {
	// Reject `$ ` immediately followed by whitespace
	if (openIdx + 1 >= line.length || isWhitespace(line[openIdx + 1])) {
		return -1;
	}

	for (let i = openIdx + 1; i < line.length; i++) {
		if (line[i] === "\\" && i + 1 < line.length) {
			i++;
			continue;
		}
		if (line[i] === "$") {
			// Disallow empty `$$` or whitespace right before closing `$`
			if (i === openIdx + 1 || isWhitespace(line[i - 1])) {
				return -1;
			}
			// Disallow `$100 ... $200` currency pattern where closing `$` is followed by a digit
			if (i + 1 < line.length && /[0-9]/.test(line[i + 1])) {
				return -1;
			}
			return i;
		}
	}

	return -1;
}

function matchMarkdownLink(
	line: string,
	startIdx: number
): { prefix: string; label: string; dest: string; endIndex: number } | null {
	const prefix = line[startIdx] === "!" ? "!" : "";
	const bracketStart = startIdx + prefix.length;
	let i = bracketStart + 1;
	let bracketDepth = 1;

	while (i < line.length && bracketDepth > 0) {
		if (line[i] === "\\" && i + 1 < line.length) {
			i += 2;
			continue;
		}
		if (line[i] === "[") {
			bracketDepth++;
		} else if (line[i] === "]") {
			bracketDepth--;
			if (bracketDepth === 0) {
				break;
			}
		}
		i++;
	}

	if (bracketDepth !== 0 || line[i + 1] !== "(") {
		return null;
	}

	const label = line.slice(bracketStart + 1, i);
	const parenStart = i + 1;
	let j = parenStart + 1;
	let parenDepth = 1;

	while (j < line.length && parenDepth > 0) {
		if (line[j] === "\\" && j + 1 < line.length) {
			j += 2;
			continue;
		}
		if (line[j] === "(") {
			parenDepth++;
		} else if (line[j] === ")") {
			parenDepth--;
			if (parenDepth === 0) {
				break;
			}
		}
		j++;
	}

	if (parenDepth !== 0) {
		return null;
	}

	return {
		prefix,
		label,
		dest: line.slice(parenStart + 1, j),
		endIndex: j + 1,
	};
}

function matchHtmlOrAutolink(
	line: string,
	startIdx: number
): { raw: string; endIndex: number } | null {
	const rest = line.slice(startIdx);
	const commentMatch = /^<!--[\s\S]*?-->/.exec(rest);
	if (commentMatch) {
		return { raw: commentMatch[0], endIndex: startIdx + commentMatch[0].length };
	}

	const autolinkMatch = /^<(?:https?:\/\/[^\s<>]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})>/.exec(
		rest
	);
	if (autolinkMatch) {
		return { raw: autolinkMatch[0], endIndex: startIdx + autolinkMatch[0].length };
	}

	const tagMatch = /^<\/?[A-Za-z][A-Za-z0-9-]*(?:\s+[^<>]*)?\/?>/.exec(rest);
	if (tagMatch) {
		return { raw: tagMatch[0], endIndex: startIdx + tagMatch[0].length };
	}

	return null;
}

function matchStarEmphasis(
	line: string,
	startIdx: number
): { marker: string; inner: string; endIndex: number } | null {
	let starLen = 1;
	while (startIdx + starLen < line.length && line[startIdx + starLen] === "*" && starLen < 3) {
		starLen++;
	}
	// If 4+ stars or immediately followed by whitespace, skip
	if (line[startIdx + starLen] === "*") {
		return null;
	}
	const contentStart = startIdx + starLen;
	if (contentStart >= line.length || isWhitespace(line[contentStart])) {
		return null;
	}

	const marker = "*".repeat(starLen);
	let i = contentStart;

	while (i < line.length) {
		if (line[i] === "\\" && i + 1 < line.length) {
			i += 2;
			continue;
		}
		// Skip inline code inside emphasis
		if (line[i] === "`") {
			let tickLen = 1;
			while (i + tickLen < line.length && line[i + tickLen] === "`") {
				tickLen++;
			}
			const closeCode = findClosingBackticks(line, i + tickLen, tickLen);
			if (closeCode !== -1) {
				i = closeCode + tickLen;
				continue;
			}
		}
		if (line.startsWith(marker, i)) {
			// Closing marker must not be preceded by whitespace and must have exact length
			const prevIsSpace = i > contentStart && isWhitespace(line[i - 1]);
			const nextIsStar = line[i + starLen] === "*";
			if (!prevIsSpace && !nextIsStar && i > contentStart) {
				return {
					marker,
					inner: line.slice(contentStart, i),
					endIndex: i + starLen,
				};
			}
		}
		i++;
	}

	return null;
}
