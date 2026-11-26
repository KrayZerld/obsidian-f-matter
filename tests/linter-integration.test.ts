import { describe, expect, it } from "vitest";
import { formatMarkdown } from "../src/linter";
import { LinterSettings } from "../src/types";

const ALL_ENABLED: LinterSettings = {
	autoBlankLine: true,
	autoSpacing: true,
	tableAlign: true,
};

const ALL_DISABLED: LinterSettings = {
	autoBlankLine: false,
	autoSpacing: false,
	tableAlign: false,
};

describe("Linter: Full Pipeline Integration & Idempotency", () => {
	it("formats a complex Markdown document in one pass and is strictly idempotent", () => {
		const input = [
			"",
			"---",
			"title: 综合测试",
			"",
			"date: 2026-11-24",
			"---",
			"#tag/keep   ",
			"##项目概览  ",
			"这是一段介绍文本。  ",
			"-第一点",
			"",
			"-第二点",
			"-[ ]待办任务",
			"",
			"-[x]已完成任务  ",
			"| 字段 | 说明 | 状态 |",
			"| :--- | :---: | ---: |",
			"| ID | 唯一标识 | 1 |",
			"| Name | 使用Obsidian插件 | 100 |",
			"```ts",
			"##do-not-touch   ",
			"| not | a | table |",
			"| - | - | - |",
			"",
			"",
			"const ok = true;",
			"```",
			"$$",
			"E = mc^2",
			"",
			"$$",
			"> [!tip] 提示",
			"> 内容行  ",
			"",
			"",
		].join("\n");

		const expected = [
			"---",
			"title: 综合测试",
			"date: 2026-11-24",
			"---",
			"",
			"#tag/keep",
			"",
			"## 项目概览",
			"",
			"这是一段介绍文本。",
			"",
			"- 第一点",
			"- 第二点",
			"- [ ] 待办任务",
			"- [x] 已完成任务",
			"",
			"| 字段 |        说明        | 状态 |",
			"| :--- | :----------------: | ---: |",
			"| ID   |      唯一标识      |    1 |",
			"| Name | 使用 Obsidian 插件 |  100 |",
			"",
			"```ts",
			"##do-not-touch   ",
			"| not | a | table |",
			"| - | - | - |",
			"",
			"",
			"const ok = true;",
			"```",
			"",
			"$$",
			"E = mc^2",
			"",
			"$$",
			"",
			"> [!tip] 提示",
			"> 内容行",
			"",
		].join("\n");

		const firstPass = formatMarkdown(input, ALL_ENABLED);
		expect(firstPass).toBe(expected);

		// Strict idempotency check
		const secondPass = formatMarkdown(firstPass, ALL_ENABLED);
		expect(secondPass).toBe(firstPass);
	});

	it("returns exact original content when all rules are disabled", () => {
		const raw = "\n\n##no-space   \n\n\n|a|b|\n|-|-|\n|1|2|";
		expect(formatMarkdown(raw, ALL_DISABLED)).toBe(raw);
	});
});
