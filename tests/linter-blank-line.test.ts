import { describe, expect, it } from "vitest";
import { formatMarkdown } from "../src/linter";
import { LinterSettings } from "../src/types";

const BLANK_ONLY: LinterSettings = {
	autoBlankLine: true,
	autoSpacing: false,
	tableAlign: false,
};

describe("Linter: Auto Blank Line", () => {
	it("removes blank lines before and inside Frontmatter and separates body with one blank line", () => {
		const input = [
			"",
			"",
			"---",
			"title: 测试笔记",
			"",
			"tags:",
			"  - notes",
			"",
			"---",
			"# 标题",
		].join("\n");

		const expected = [
			"---",
			"title: 测试笔记",
			"tags:",
			"  - notes",
			"---",
			"",
			"# 标题",
			"",
		].join("\n");

		expect(formatMarkdown(input, BLANK_ONLY)).toBe(expected);
	});

	it("treats unclosed --- at top of file as horizontal rule instead of Frontmatter", () => {
		const input = ["---", "正文内容"].join("\n");
		const expected = ["---", "", "正文内容", ""].join("\n");
		expect(formatMarkdown(input, BLANK_ONLY)).toBe(expected);
	});

	it("inserts blank lines around all block-level elements without adding one before the first line", () => {
		const input = [
			"# Heading",
			"Paragraph 1",
			"> [!note] Callout",
			"> Line 2",
			"Paragraph 2",
			"```ts",
			"const x = 1;",
			"",
			"",
			"const y = 2;",
			"```",
			"---",
			"$$",
			"a^2 + b^2 = c^2",
			"",
			"$$",
			"| A | B |",
			"| - | - |",
			"| 1 | 2 |",
			"- item 1",
			"- item 2",
			"End paragraph",
		].join("\n");

		const expected = [
			"# Heading",
			"",
			"Paragraph 1",
			"",
			"> [!note] Callout",
			"> Line 2",
			"",
			"Paragraph 2",
			"",
			"```ts",
			"const x = 1;",
			"",
			"",
			"const y = 2;",
			"```",
			"",
			"---",
			"",
			"$$",
			"a^2 + b^2 = c^2",
			"",
			"$$",
			"",
			"| A | B |",
			"| - | - |",
			"| 1 | 2 |",
			"",
			"- item 1",
			"- item 2",
			"",
			"End paragraph",
			"",
		].join("\n");

		expect(formatMarkdown(input, BLANK_ONLY)).toBe(expected);
	});

	it("compacts blank lines inside list and checklist blocks while preserving nested code fences", () => {
		const input = [
			"- item 1",
			"",
			"- item 2",
			"  - sub 1",
			"",
			"  - sub 2",
			"  ```js",
			"  const a = 1;",
			"",
			"",
			"  const b = 2;",
			"  ```",
			"",
			"- item 3",
			"",
			"Paragraph",
			"",
			"- [ ] task 1",
			"",
			"- [x] task 2",
		].join("\n");

		const expected = [
			"- item 1",
			"- item 2",
			"  - sub 1",
			"  - sub 2",
			"  ```js",
			"  const a = 1;",
			"",
			"",
			"  const b = 2;",
			"  ```",
			"- item 3",
			"",
			"Paragraph",
			"",
			"- [ ] task 1",
			"- [x] task 2",
			"",
		].join("\n");

		expect(formatMarkdown(input, BLANK_ONLY)).toBe(expected);
	});

	it("collapses multiple consecutive blank lines to one and enforces single trailing newline", () => {
		const input = [
			"Para 1",
			"",
			"",
			"",
			"Para 2",
			"",
			"",
			"~~~md",
			"keep",
			"",
			"",
			"blank lines inside tilde fence",
			"~~~",
			"",
			"",
			"",
		].join("\n");

		const expected = [
			"Para 1",
			"",
			"Para 2",
			"",
			"~~~md",
			"keep",
			"",
			"",
			"blank lines inside tilde fence",
			"~~~",
			"",
		].join("\n");

		expect(formatMarkdown(input, BLANK_ONLY)).toBe(expected);
	});

	it("returns empty string for blank-only input", () => {
		expect(formatMarkdown("   \n\n\t\n", BLANK_ONLY)).toBe("");
	});
});
