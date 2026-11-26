import { App, PluginSettingTab, SettingGroup, moment } from "obsidian";
import type FmatterPlugin from "../main";
import { sanitizeFileName } from "../automation/timestampRenamer";
import { AddMappingModal } from "./AddMappingModal";

type SettingTabKey = "linter" | "frontmatter" | "timestamp";

const TAB_ITEMS: Array<{ key: SettingTabKey; label: string }> = [
	{ key: "linter", label: "Linter" },
	{ key: "frontmatter", label: "Frontmatter" },
	{ key: "timestamp", label: "Timestamp" },
];

export class FmatterSettingTab extends PluginSettingTab {
	private readonly plugin: FmatterPlugin;
	private activeTab: SettingTabKey = "linter";

	constructor(app: App, plugin: FmatterPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("fmatter-settings");

		// Top 3-tab underline switcher bar
		const tabBarEl = containerEl.createDiv({
			cls: "fmatter-tab-bar",
			attr: { role: "tablist" },
		});
		for (const tab of TAB_ITEMS) {
			const tabBtn = tabBarEl.createEl("button", {
				text: tab.label,
				cls: "fmatter-tab-button",
				attr: {
					type: "button",
					role: "tab",
					"aria-selected": String(this.activeTab === tab.key),
				},
			});
			if (this.activeTab === tab.key) {
				tabBtn.addClass("is-active");
			}
			tabBtn.addEventListener("click", () => {
				if (this.activeTab !== tab.key) {
					this.activeTab = tab.key;
					this.display();
				}
			});
		}

		const panelEl = containerEl.createDiv({
			cls: "fmatter-tab-panel",
			attr: { role: "tabpanel" },
		});
		if (this.activeTab === "linter") {
			this.renderLinterTab(panelEl);
		} else if (this.activeTab === "frontmatter") {
			this.renderFrontmatterTab(panelEl);
		} else {
			this.renderTimestampTab(panelEl);
		}
	}

	private renderLinterTab(container: HTMLElement): void {
		const group = new SettingGroup(container).setHeading("Markdown 自动格式化规则");

		group.addSetting((setting) =>
			setting
				.setName("自动空行")
				.setDesc(
					"清理 Frontmatter 空行、确保块级元素前后留空、紧缩列表内部空行、合并连续空行并规范末尾换行"
				)
				.addToggle((toggle) =>
					toggle
						.setValue(this.plugin.settings.linter.autoBlankLine)
						.onChange(async (value) => {
							this.plugin.settings.linter.autoBlankLine = value;
							await this.plugin.saveSettings();
						})
				)
		);

		group.addSetting((setting) =>
			setting
				.setName("自动空格")
				.setDesc(
					"为标题（## ~ ######）、列表、Checkbox 及中英文/数字混排补全空格，并清理行尾多余空白（保护单 # 标签、代码与公式）"
				)
				.addToggle((toggle) =>
					toggle
						.setValue(this.plugin.settings.linter.autoSpacing)
						.onChange(async (value) => {
							this.plugin.settings.linter.autoSpacing = value;
							await this.plugin.saveSettings();
						})
				)
		);

		group.addSetting((setting) =>
			setting
				.setName("表格对齐")
				.setDesc("按等宽字体显示宽度（支持中英文混排）对齐 Markdown 表格并保留原有列对齐方式")
				.addToggle((toggle) =>
					toggle
						.setValue(this.plugin.settings.linter.tableAlign)
						.onChange(async (value) => {
							this.plugin.settings.linter.tableAlign = value;
							await this.plugin.saveSettings();
						})
				)
		);
	}

	private renderFrontmatterTab(container: HTMLElement): void {
		const group = new SettingGroup(container)
			.setHeading("文件夹 Frontmatter 模板映射")
			.addExtraButton((btn) =>
				btn
					.setIcon("plus")
					.setTooltip("添加 Frontmatter 模板映射")
					.onClick(() => {
						new AddMappingModal(
							this.app,
							this.plugin.settings.frontmatterMappings,
							async (newMapping) => {
								this.plugin.settings.frontmatterMappings.push(newMapping);
								await this.plugin.saveSettings();
								this.display();
							}
						).open();
					})
			);

		const mappings = this.plugin.settings.frontmatterMappings;

		if (mappings.length === 0) {
			group.addSetting((setting) => {
				setting.setDesc(
					"暂无映射规则，点击右上角「+」添加文件夹与 Frontmatter 模板的对应关系。"
				);
				setting.settingEl.addClass("fmatter-empty-setting");
			});
			return;
		}

		mappings.forEach((mapping, index) => {
			group.addSetting((setting) =>
				setting
					.setName(mapping.folderPath === "/" ? "/ (根目录)" : mapping.folderPath)
					.setDesc(`模板：${mapping.templatePath}`)
					.addExtraButton((btn) => {
						btn
							.setIcon("trash")
							.setTooltip("删除该映射")
							.onClick(async () => {
								this.plugin.settings.frontmatterMappings.splice(index, 1);
								await this.plugin.saveSettings();
								this.display();
							});
						btn.extraSettingsEl.addClass("fmatter-danger-icon");
					})
			);
		});
	}

	private renderTimestampTab(container: HTMLElement): void {
		const group = new SettingGroup(container).setHeading("新建笔记时间戳重命名");

		let previewLabelEl: HTMLElement | null = null;
		let previewValueEl: HTMLElement | null = null;

		const updatePreview = (fmt: string): void => {
			if (!previewLabelEl || !previewValueEl) {
				return;
			}
			const trimmed = fmt.trim();
			if (!trimmed) {
				previewLabelEl.setText("当前状态：");
				previewValueEl.setText("已禁用（留空不重命名）");
				previewValueEl.removeClass("u-pop");
				return;
			}
			const formatted = sanitizeFileName(moment().format(trimmed));
			if (formatted) {
				previewLabelEl.setText("当前预览：");
				previewValueEl.setText(`${formatted}.md`);
				previewValueEl.addClass("u-pop");
			} else {
				previewLabelEl.setText("当前状态：");
				previewValueEl.setText("生成文件名为空，不会触发重命名");
				previewValueEl.removeClass("u-pop");
			}
		};

		const descFragment = createFragment((frag) => {
			frag.appendText("使用 Moment.js 格式语法；留空则新建空笔记时不重命名");
			frag.createEl("br");
			previewLabelEl = frag.createSpan();
			previewValueEl = frag.createSpan();
		});

		group.addSetting((setting) =>
			setting
				.setName("时间戳格式")
				.setDesc(descFragment)
				.addText((text) => {
					text.setPlaceholder("YYYYMMDDHHmmss");
					text.setValue(this.plugin.settings.timestampFormat);
					text.inputEl.addClass("fmatter-input");
					text.onChange(async (value) => {
						this.plugin.settings.timestampFormat = value;
						updatePreview(value);
						await this.plugin.saveSettings();
					});
				})
		);

		updatePreview(this.plugin.settings.timestampFormat);
	}
}
