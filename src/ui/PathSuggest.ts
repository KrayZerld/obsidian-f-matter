import {
	AbstractInputSuggest,
	App,
	TFile,
	TFolder,
	prepareFuzzySearch,
} from "obsidian";
import { normalizeFolderPath } from "../automation/frontmatterInjector";

/**
 * Autocomplete suggest for all Vault folder paths (including root "/"),
 * powered by Obsidian's native AbstractInputSuggest & prepareFuzzySearch.
 */
export class FolderSuggest extends AbstractInputSuggest<string> {
	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
	}

	protected override getSuggestions(query: string): string[] {
		const folderPaths = new Set<string>(["/"]);

		for (const abstractFile of this.app.vault.getAllLoadedFiles()) {
			if (abstractFile instanceof TFolder) {
				folderPaths.add(normalizeFolderPath(abstractFile.path));
			}
		}

		const sorted = Array.from(folderPaths).sort((a, b) => {
			if (a === "/") return -1;
			if (b === "/") return 1;
			return a.localeCompare(b);
		});

		const trimmed = query.trim();
		if (!trimmed) {
			return sorted;
		}

		const fuzzy = prepareFuzzySearch(trimmed);
		return sorted
			.map((path) => ({ path, match: fuzzy(path) }))
			.filter((item) => item.match !== null)
			.sort((a, b) => (b.match?.score ?? 0) - (a.match?.score ?? 0))
			.map((item) => item.path);
	}

	renderSuggestion(folderPath: string, el: HTMLElement): void {
		el.setText(folderPath === "/" ? "/ (根目录)" : folderPath);
	}

	override selectSuggestion(folderPath: string, evt: MouseEvent | KeyboardEvent): void {
		this.setValue(folderPath);
		super.selectSuggestion(folderPath, evt);
		this.close();
	}
}

/**
 * Autocomplete suggest for all Markdown (.md) files in the Vault,
 * powered by Obsidian's native AbstractInputSuggest & prepareFuzzySearch.
 */
export class MarkdownFileSuggest extends AbstractInputSuggest<TFile> {
	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
	}

	protected override getSuggestions(query: string): TFile[] {
		const files = this.app.vault
			.getMarkdownFiles()
			.slice()
			.sort((a, b) => a.path.localeCompare(b.path));

		const trimmed = query.trim();
		if (!trimmed) {
			return files;
		}

		const fuzzy = prepareFuzzySearch(trimmed);
		return files
			.map((file) => ({ file, match: fuzzy(file.path) }))
			.filter((item) => item.match !== null)
			.sort((a, b) => (b.match?.score ?? 0) - (a.match?.score ?? 0))
			.map((item) => item.file);
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		el.setText(file.path);
	}

	override selectSuggestion(file: TFile, evt: MouseEvent | KeyboardEvent): void {
		this.setValue(file.path);
		super.selectSuggestion(file, evt);
		this.close();
	}
}
