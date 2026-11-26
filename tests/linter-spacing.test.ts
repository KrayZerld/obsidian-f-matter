import { describe, expect, it } from "vitest";
import { formatMarkdown } from "../src/linter";
import { LinterSettings } from "../src/types";

const SPACING_ONLY: LinterSettings = {
	autoBlankLine: false,
	autoSpacing: true,
	tableAlign: false,
};

describe("Linter: Auto Spacing", () => {
	it("adds space after ## ~ ###### headings but preserves single # Obsidian tags", () => {
		const input = [
			"#tag",
			"#项目/笔记",
			"#tag1 #tag2",
			"##二级标题",
			"###三级标题",
			"######六级标题",
			"## 已有空格标题",
		].join("\n");

		const expected = [
			"#tag",
			"#项目/笔记",
			"#tag1 #tag2",
			"## 二级标题",
			"### 三级标题",
			"###### 六级标题",
			"## 已有空格标题",
		].join("\n");

		expect(formatMarkdown(input, SPACING_ONLY)).toBe(expected);
	});

	it("adds space after unordered/ordered list markers without breaking hr, emphasis, flags, or decimals", () => {
		const input = [
			"-第一项",
			"+第二项",
			"*第三项",
			"1.有序项",
			"  2.缩进有序项",
			"---",
			"***",
			"___",
			"*italic text*",
			"**bold text**",
			"***bold italic***",
			"--cli-flag",
			"1.5 is a decimal",
		].join("\n");

		const expected = [
			"- 第一项",
			"+ 第二项",
			"* 第三项",
			"1. 有序项",
			"  2. 缩进有序项",
			"---",
			"***",
			"___",
			"*italic text*",
			"**bold text**",
			"***bold italic***",
			"--cli-flag",
			"1.5 is a decimal",
		].join("\n");

		expect(formatMarkdown(input, SPACING_ONLY)).toBe(expected);
	});

	it("adds space after task checkboxes and strips trailing spaces/tabs", () => {
		const input = [
			"- [ ]待办事项   ",
			"- [x]已完成\t\t",
			"-[ ]紧凑待办 ",
			"1. [X]有序待办  ",
			"普通正文行   \t ",
		].join("\n");

		const expected = [
			"- [ ] 待办事项",
			"- [x] 已完成",
			"- [ ] 紧凑待办",
			"1. [X] 有序待办",
			"普通正文行",
		].join("\n");

		expect(formatMarkdown(input, SPACING_ONLY)).toBe(expected);
	});

	it("skips Frontmatter, fenced code blocks, and math blocks completely", () => {
		const input = [
			"---",
			"title: keep trailing   ",
			"##not-a-heading",
			"---",
			"##需要空格   ",
			"```python",
			"##comment   ",
			"-not-a-list\t",
			"- [ ]not-a-task  ",
			"```",
			"$$",
			"##math   ",
			"-x + y  ",
			"$$",
		].join("\n");

		const expected = [
			"---",
			"title: keep trailing   ",
			"##not-a-heading",
			"---",
			"## 需要空格",
			"```python",
			"##comment   ",
			"-not-a-list\t",
			"- [ ]not-a-task  ",
			"```",
			"$$",
			"##math   ",
			"-x + y  ",
			"$$",
		].join("\n");

		expect(formatMarkdown(input, SPACING_ONLY)).toBe(expected);
	});

	it("does not treat inline triple-backtick code span as a fenced code block opener", () => {
		const input = [
			"Use ```inline code``` here   ",
			"##后面的标题仍然生效  ",
		].join("\n");

		const expected = [
			"Use ```inline code``` here",
			"## 后面的标题仍然生效",
		].join("\n");

		expect(formatMarkdown(input, SPACING_ONLY)).toBe(expected);
	});

	it("adds Pangu-style spaces between CJK ideographs and English/digits while excluding punctuation", () => {
		const input = [
			"使用Obsidian插件提升效率",
			"第1章：2026年11月共3项任务",
			"《Obsidian指南》（2026版），支持Markdown！",
			"已有 Obsidian 2026 空格不重复添加",
			"##中文English标题",
			"-支持TypeScript开发",
			"- [ ]完成v0.1.0发布",
		].join("\n");

		const expected = [
			"使用 Obsidian 插件提升效率",
			"第 1 章：2026 年 11 月共 3 项任务",
			"《Obsidian 指南》（2026 版），支持 Markdown！",
			"已有 Obsidian 2026 空格不重复添加",
			"## 中文 English 标题",
			"- 支持 TypeScript 开发",
			"- [ ] 完成 v0.1.0 发布",
		].join("\n");

		const first = formatMarkdown(input, SPACING_ONLY);
		expect(first).toBe(expected);
		// Idempotency
		expect(formatMarkdown(first, SPACING_ONLY)).toBe(first);
	});

	it("protects inline code, inline math, URLs, WikiLinks, links, HTML, and #tags while spacing boundaries", () => {
		const input = [
			"使用`Obsidian`插件和``a|b``代码",
			"当$x=1$时解为$y=2$成立",
			"这是**Bold**文本与*italic*说明，但保留**纯中文**加粗",
			"内部混排**使用Obsidian插件**也要整理",
			"访问https://obsidian.md查看文档",
			"链接[使用Obsidian指南](https://example.com/Obsidian中文)不变地址",
			"引用[[Obsidian笔记]]和![[图2026.png]]不被破坏",
			"#笔记Obsidian",
			"标签 #笔记Obsidian 与 #2026年 保持完整",
			"行内HTML<span>中文Text</span>不破坏标签",
			"花了$100和$200元不是公式",
		].join("\n");

		const expected = [
			"使用 `Obsidian` 插件和 ``a|b`` 代码",
			"当 $x=1$ 时解为 $y=2$ 成立",
			"这是 **Bold** 文本与 *italic* 说明，但保留**纯中文**加粗",
			"内部混排**使用 Obsidian 插件**也要整理",
			"访问 https://obsidian.md 查看文档",
			"链接[使用 Obsidian 指南](https://example.com/Obsidian中文)不变地址",
			"引用[[Obsidian笔记]]和![[图2026.png]]不被破坏",
			"#笔记Obsidian",
			"标签 #笔记Obsidian 与 #2026年 保持完整",
			"行内 HTML<span>中文 Text</span>不破坏标签",
			"花了$100 和$200 元不是公式",
		].join("\n");

		const first = formatMarkdown(input, SPACING_ONLY);
		expect(first).toBe(expected);
		expect(formatMarkdown(first, SPACING_ONLY)).toBe(first);
	});
});
