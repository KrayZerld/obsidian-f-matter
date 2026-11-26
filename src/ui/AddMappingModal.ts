import { App, ButtonComponent, Modal, Setting, TFile } from "obsidian";
import { normalizeFolderPath } from "../automation/frontmatterInjector";
import { FrontmatterMapping } from "../types";
import { FolderSuggest, MarkdownFileSuggest } from "./PathSuggest";

export class AddMappingModal extends Modal {
	private readonly existingMappings: FrontmatterMapping[];
	private readonly onSubmit: (mapping: FrontmatterMapping) => void;

	private folderValue = "";
	private templateValue = "";
	private errorEl: HTMLElement | null = null;

	constructor(
		app: App,
		existingMappings: FrontmatterMapping[],
		onSubmit: (mapping: FrontmatterMapping) => void
	) {
		super(app);
		this.existingMappings = existingMappings;
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.modalEl.addClass("fmatter-mapping-modal");
		this.setTitle("添加 Frontmatter 模板映射");

		new Setting(contentEl)
			.setName("文件夹路径")
			.setDesc("匹配新建笔记所在的文件夹（支持根目录 /，子文件夹按最长路径优先匹配）")
			.addText((text) => {
				text.setPlaceholder("/ 或 Notes/Daily");
				text.inputEl.addClass("fmatter-input");
				text.onChange((val) => {
					this.folderValue = val;
					this.clearError();
				});
				new FolderSuggest(this.app, text.inputEl).onSelect((selectedPath) => {
					this.folderValue = selectedPath;
					this.clearError();
				});
			});

		new Setting(contentEl)
			.setName("模板文件")
			.setDesc("选择包含 YAML Frontmatter 的 Markdown 模板文件")
			.addText((text) => {
				text.setPlaceholder("Templates/default.md");
				text.inputEl.addClass("fmatter-input");
				text.onChange((val) => {
					this.templateValue = val;
					this.clearError();
				});
				new MarkdownFileSuggest(this.app, text.inputEl).onSelect((selectedFile) => {
					this.templateValue = selectedFile.path;
					this.clearError();
				});
			});

		this.errorEl = contentEl.createDiv({ cls: "fmatter-modal-error" });

		const buttonContainer = contentEl.createDiv({ cls: "modal-button-container" });
		new ButtonComponent(buttonContainer)
			.setButtonText("取消")
			.onClick(() => this.close());
		new ButtonComponent(buttonContainer)
			.setButtonText("确认")
			.setCta()
			.onClick(() => this.handleConfirm());
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private clearError(): void {
		if (this.errorEl) {
			this.errorEl.setText("");
			this.errorEl.removeClass("is-visible");
		}
	}

	private showError(message: string): void {
		if (this.errorEl) {
			this.errorEl.setText(message);
			this.errorEl.addClass("is-visible");
		}
	}

	private handleConfirm(): void {
		const rawFolder = this.folderValue.trim();
		const rawTemplate = this.templateValue.trim().replace(/\\/g, "/").replace(/^\/+/, "");

		if (!rawFolder) {
			this.showError("请输入文件夹路径（根目录请填写 /）。");
			return;
		}
		if (!rawTemplate) {
			this.showError("请选择或输入模板文件路径。");
			return;
		}

		const normalizedFolder = normalizeFolderPath(rawFolder);
		const isDuplicate = this.existingMappings.some(
			(item) => normalizeFolderPath(item.folderPath) === normalizedFolder
		);
		if (isDuplicate) {
			this.showError(`文件夹路径 "${normalizedFolder}" 已存在映射规则，请勿重复添加。`);
			return;
		}

		const targetFile = this.app.vault.getAbstractFileByPath(rawTemplate);
		if (!(targetFile instanceof TFile) || targetFile.extension.toLowerCase() !== "md") {
			this.showError(`未找到 Markdown 模板文件："${rawTemplate}"。`);
			return;
		}

		this.onSubmit({
			folderPath: normalizedFolder,
			templatePath: targetFile.path,
		});
		this.close();
	}
}
