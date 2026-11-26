import { App, TFile, Vault, moment } from "obsidian";

/**
 * Remove characters illegal in file names across Windows/macOS/Linux.
 */
export function sanitizeFileName(rawName: string): string {
	return rawName
		.replace(/[\\/:*?"<>|]/g, "-")
		.replace(/\s+/g, " ")
		.trim()
		.replace(/\.+$/, "");
}

/**
 * Resolve a non-conflicting `.md` file path in the same folder.
 * If `<baseName>.md` already exists, appends `-1`, `-2`, ... until unique.
 */
export function resolveUniqueMarkdownPath(
	vault: Vault,
	parentPath: string,
	baseName: string,
	currentPath: string
): string {
	const normalizedParent = parentPath.replace(/^\/+/, "").replace(/\/+$/, "");
	const prefix = normalizedParent ? `${normalizedParent}/` : "";

	let candidate = `${prefix}${baseName}.md`;
	if (candidate === currentPath || vault.getAbstractFileByPath(candidate) === null) {
		return candidate;
	}

	let suffix = 1;
	while (true) {
		candidate = `${prefix}${baseName}-${suffix}.md`;
		if (candidate === currentPath || vault.getAbstractFileByPath(candidate) === null) {
			return candidate;
		}
		suffix++;
	}
}

/**
 * Step 2 of new-file automation:
 * Format current timestamp using Obsidian's built-in `moment`, resolve naming conflicts,
 * and rename the file via `app.fileManager.renameFile`.
 */
export async function renameFileWithTimestamp(
	app: App,
	file: TFile,
	timestampFormat: string
): Promise<string | null> {
	const trimmedFormat = timestampFormat.trim();
	if (!trimmedFormat) {
		return null;
	}

	const formattedRaw = moment().format(trimmedFormat);
	const baseName = sanitizeFileName(formattedRaw);
	if (!baseName) {
		return null;
	}

	const parentPath = file.parent ? file.parent.path : "";
	const targetPath = resolveUniqueMarkdownPath(app.vault, parentPath, baseName, file.path);

	if (targetPath === file.path) {
		return targetPath;
	}

	await app.fileManager.renameFile(file, targetPath);
	return targetPath;
}
