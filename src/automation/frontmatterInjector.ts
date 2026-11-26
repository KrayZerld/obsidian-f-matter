import { App, TFile } from "obsidian";
import { FrontmatterMapping } from "../types";

/**
 * Normalize a Vault folder path for reliable comparison:
 * - Root folder is always "/"
 * - Non-root paths use forward slashes with no leading or trailing "/"
 */
export function normalizeFolderPath(rawPath: string): string {
	const cleaned = rawPath.replace(/\\/g, "/").trim();
	if (!cleaned || cleaned === "/" || cleaned === ".") {
		return "/";
	}
	const stripped = cleaned.replace(/^\/+/, "").replace(/\/+$/, "");
	return stripped.length === 0 ? "/" : stripped;
}

/**
 * Find the best matching Frontmatter mapping for a folder path using longest-path-first strategy.
 * - Rule "/" matches every folder with specificity 0.
 * - Rule "A/B" matches "A/B" and any descendant "A/B/..." with specificity equal to its normalized length.
 */
export function findBestMatchingMapping(
	folderPath: string,
	mappings: FrontmatterMapping[]
): FrontmatterMapping | null {
	const target = normalizeFolderPath(folderPath);
	let bestMapping: FrontmatterMapping | null = null;
	let bestScore = -1;

	for (const mapping of mappings) {
		const ruleFolder = normalizeFolderPath(mapping.folderPath);
		let matched = false;
		let score = -1;

		if (ruleFolder === "/") {
			matched = true;
			score = 0;
		} else if (target === ruleFolder || target.startsWith(`${ruleFolder}/`)) {
			matched = true;
			score = ruleFolder.length;
		}

		if (matched && score > bestScore) {
			bestScore = score;
			bestMapping = mapping;
		}
	}

	return bestMapping;
}

/**
 * Extract only the leading YAML Frontmatter block (`--- ... ---`) verbatim from a template file.
 * Returns null if the template does not begin with a valid closed YAML Frontmatter block.
 */
export function extractYamlFrontmatter(templateContent: string): string | null {
	const cleaned = templateContent.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
	const lines = cleaned.split("\n");

	if (lines.length < 2 || !/^---[ \t]*$/.test(lines[0])) {
		return null;
	}

	for (let i = 1; i < lines.length; i++) {
		if (/^(---|\.\.\.)[ \t]*$/.test(lines[i])) {
			return lines.slice(0, i + 1).join("\n");
		}
	}

	return null;
}

/**
 * Step 1 of new-file automation:
 * Match the parent folder against Frontmatter mappings (longest-path-first),
 * read the template file, extract its YAML Frontmatter block, and write it to the newly created file.
 */
export async function injectFrontmatterForFile(
	app: App,
	file: TFile,
	mappings: FrontmatterMapping[]
): Promise<boolean> {
	if (mappings.length === 0) {
		return false;
	}

	const parentFolderPath = file.parent ? file.parent.path : "/";
	const matched = findBestMatchingMapping(parentFolderPath, mappings);
	if (!matched) {
		return false;
	}

	const templatePath = matched.templatePath.trim().replace(/\\/g, "/").replace(/^\/+/, "");
	if (!templatePath) {
		return false;
	}

	const abstractTemplate = app.vault.getAbstractFileByPath(templatePath);
	if (!(abstractTemplate instanceof TFile)) {
		return false;
	}

	const templateContent = await app.vault.read(abstractTemplate);
	const frontmatterBlock = extractYamlFrontmatter(templateContent);
	if (!frontmatterBlock) {
		return false;
	}

	await app.vault.modify(file, `${frontmatterBlock}\n`);
	return true;
}
