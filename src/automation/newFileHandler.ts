import { App, EventRef, TFile } from "obsidian";
import { FmatterSettings } from "../types";
import { injectFrontmatterForFile } from "./frontmatterInjector";
import { renameFileWithTimestamp } from "./timestampRenamer";

const NEW_FILE_MAX_AGE_MS = 5000;

/**
 * Orchestrates new Markdown file automation safely:
 * 1. Registers `vault.on('create')` strictly inside `workspace.onLayoutReady()` to prevent startup misfires.
 * 2. Guards against non-Markdown files, stale/synced/dropped files, and non-empty files.
 * 3. Runs Frontmatter template injection BEFORE timestamp renaming sequentially to avoid path races.
 */
export class NewFileAutomation {
	private readonly app: App;
	private readonly getSettings: () => FmatterSettings;
	private readonly processingPaths = new Set<string>();
	private disposed = false;

	constructor(app: App, getSettings: () => FmatterSettings) {
		this.app = app;
		this.getSettings = getSettings;
	}

	start(registerEvent: (eventRef: EventRef) => void): void {
		this.disposed = false;
		this.app.workspace.onLayoutReady(() => {
			if (this.disposed) {
				return;
			}
			registerEvent(
				this.app.vault.on("create", (abstractFile) => {
					if (abstractFile instanceof TFile) {
						void this.handleCreate(abstractFile);
					}
				})
			);
		});
	}

	dispose(): void {
		this.disposed = true;
		this.processingPaths.clear();
	}

	private async handleCreate(file: TFile): Promise<void> {
		if (this.disposed) {
			return;
		}
		if (file.extension.toLowerCase() !== "md") {
			return;
		}

		// Guard: only handle freshly created files (avoid synced/dragged/existing files)
		const ageMs = Date.now() - file.stat.ctime;
		if (ageMs > NEW_FILE_MAX_AGE_MS || ageMs < -NEW_FILE_MAX_AGE_MS) {
			return;
		}

		const initialPath = file.path;
		if (this.processingPaths.has(initialPath)) {
			return;
		}

		const settings = this.getSettings();
		const hasFrontmatterRules = settings.frontmatterMappings.length > 0;
		const hasTimestampFormat = settings.timestampFormat.trim().length > 0;
		if (!hasFrontmatterRules && !hasTimestampFormat) {
			return;
		}

		this.processingPaths.add(initialPath);
		try {
			// Guard: only process empty newly created files
			const currentContent = await this.app.vault.read(file);
			if (currentContent.trim() !== "") {
				return;
			}

			// Step 1: Match parent folder and inject Frontmatter YAML block
			if (hasFrontmatterRules) {
				await injectFrontmatterForFile(this.app, file, settings.frontmatterMappings);
			}

			// Step 2: Rename file basename with timestamp (after writing Frontmatter)
			if (hasTimestampFormat) {
				await renameFileWithTimestamp(this.app, file, settings.timestampFormat);
			}
		} catch (error) {
			console.error("[f-Matter] Failed to process newly created file:", initialPath, error);
		} finally {
			this.processingPaths.delete(initialPath);
		}
	}
}
