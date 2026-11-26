import { describe, expect, it } from "vitest";
import { formatMarkdown } from "../src/linter";
import { getDisplayWidth } from "../src/linter/width";
import { LinterSettings } from "../src/types";

const TABLE_ONLY: LinterSettings = {
	autoBlankLine: false,
	autoSpacing: false,
	tableAlign: true,
};

describe("Linter: Table Alignment & CJK Display Width", () => {
	it("computes East Asian display widths accurately", () => {
		expect(getDisplayWidth("abc")).toBe(3);
		expect(getDisplayWidth("中文")).toBe(4);
		expect(getDisplayWidth("中A文1")).toBe(6);
		expect(getDisplayWidth("你好，世界！")).toBe(12);
		expect(getDisplayWidth("日本語")).toBe(6);
		expect(getDisplayWidth("한글")).toBe(4);
	});

	it("aligns mixed CJK/ASCII tables with exact visual column widths and preserves alignments", () => {
		const input = [
			"| 姓名 | Age | 备注 | 评分 |",
			"| :--- | ---: | :---: | --- |",
			"| 张三 | 18 | 测试数据 | A+ |",
			"| Alice | 7 | OK | 优秀 |",
		].join("\n");

		const output = formatMarkdown(input, TABLE_ONLY);
		const lines = output.split("\n");

		expect(lines).toEqual([
			"| 姓名  | Age |   备注   | 评分 |",
			"| :---- | --: | :------: | ---- |",
			"| 张三  |  18 | 测试数据 | A+   |",
			"| Alice |   7 |    OK    | 优秀 |",
		]);

		// Every row must have identical monospace display width
		const widths = lines.map((line) => getDisplayWidth(line));
		expect(new Set(widths).size).toBe(1);
	});

	it("handles escaped pipes and inline code pipes without mis-splitting cells", () => {
		const input = [
			"| 表达式 | 说明 |",
			"| --- | --- |",
			"| `a \\| b` | 位或 `x|y` |",
			"| foo\\|bar | 转义竖线 |",
		].join("\n");

		const output = formatMarkdown(input, TABLE_ONLY);
		const lines = output.split("\n");

		expect(lines).toHaveLength(4);
		expect(lines[2]).toContain("`a \\| b`");
		expect(lines[2]).toContain("位或 `x|y`");
		expect(lines[3]).toContain("foo\\|bar");
		expect(new Set(lines.map((l) => getDisplayWidth(l))).size).toBe(1);
	});

	it("pads ragged rows with missing columns and skips tables inside code fences", () => {
		const input = [
			"| Col1 | Col2 | Col3 |",
			"| --- | --- |",
			"| A |",
			"",
			"```md",
			"| A | B |",
			"| - | - |",
			"| 1 | 2 |",
			"```",
		].join("\n");

		const expected = [
			"| Col1 | Col2 | Col3 |",
			"| ---- | ---- | ---- |",
			"| A    |      |      |",
			"",
			"```md",
			"| A | B |",
			"| - | - |",
			"| 1 | 2 |",
			"```",
		].join("\n");

		expect(formatMarkdown(input, TABLE_ONLY)).toBe(expected);
	});
});
