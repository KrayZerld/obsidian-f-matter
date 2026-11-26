import { describe, expect, it } from "vitest";
import type { App, TFile } from "obsidian";
import {
	extractYamlFrontmatter,
	findBestMatchingMapping,
	normalizeFolderPath,
} from "../src/automation/frontmatterInjector";
import { NewFileAutomation } from "../src/automation/newFileHandler";
import { resolveUniqueMarkdownPath, sanitizeFileName } from "../src/automation/timestampRenamer";
import { DEFAULT_SETTINGS, FmatterSettings, FrontmatterMapping } from "../src/types";
import { createMockFile } from "./mocks/obsidian";

describe("Automation: Frontmatter Mapping & Extraction", () => {
	it("normalizes folder paths consistently", () => {
		expect(normalizeFolderPath("")).toBe("/");
		expect(normalizeFolderPath("/")).toBe("/");
		expect(normalizeFolderPath("///")).toBe("/");
		expect(normalizeFolderPath("/Notes/Daily/")).toBe("Notes/Daily");
		expect(normalizeFolderPath("Notes\\Daily\\")).toBe("Notes/Daily");
	});

	it("matches folder mappings using longest-path-first strategy", () => {
		const mappings: FrontmatterMapping[] = [
			{ folderPath: "/", templatePath: "Templates/root.md" },
			{ folderPath: "Notes", templatePath: "Templates/notes.md" },
			{ folderPath: "Notes/Daily", templatePath: "Templates/daily.md" },
		];

		expect(findBestMatchingMapping("/", mappings)?.templatePath).toBe("Templates/root.md");
		expect(findBestMatchingMapping("Inbox", mappings)?.templatePath).toBe("Templates/root.md");
		expect(findBestMatchingMapping("Notes", mappings)?.templatePath).toBe("Templates/notes.md");
		expect(findBestMatchingMapping("Notes/Projects", mappings)?.templatePath).toBe(
			"Templates/notes.md"
		);
		expect(findBestMatchingMapping("Notes/Daily", mappings)?.templatePath).toBe(
			"Templates/daily.md"
		);
		expect(findBestMatchingMapping("Notes/Daily/2026", mappings)?.templatePath).toBe(
			"Templates/daily.md"
		);
		// Prefix collision guard: "Notes2" must not match "Notes"
		expect(findBestMatchingMapping("Notes2", mappings)?.templatePath).toBe("Templates/root.md");
	});

	it("extracts only the leading YAML Frontmatter block verbatim without template body", () => {
		const template = [
			"---",
			"type: daily",
			"tags:",
			"  - journal",
			"---",
			"",
			"# 模板正文不应被注入",
			"Some body text",
		].join("\n");

		expect(extractYamlFrontmatter(template)).toBe(
			["---", "type: daily", "tags:", "  - journal", "---"].join("\n")
		);

		expect(extractYamlFrontmatter("# No frontmatter here\n---\nbody\n---")).toBeNull();
		expect(extractYamlFrontmatter("---\nunclosed: true\n")).toBeNull();
	});

	it("sanitizes illegal filename characters safely", () => {
		expect(sanitizeFileName("2026/11/24 20:15:20")).toBe("2026-11-24 20-15-20");
		expect(sanitizeFileName("20261124201520")).toBe("20261124201520");
	});

	it("resolves naming collisions by appending -1, -2 suffixes", () => {
		const existing = new Set(["Notes/20261124203000.md", "Notes/20261124203000-1.md"]);
		const mockVault = {
			getAbstractFileByPath: (p: string) =>
				existing.has(p) ? (createMockFile(p) as unknown as TFile) : null,
		} as unknown as App["vault"];

		expect(
			resolveUniqueMarkdownPath(mockVault, "Notes", "20261124203000", "Notes/Untitled.md")
		).toBe("Notes/20261124203000-2.md");
	});

	it("runs Frontmatter injection before timestamp renaming sequentially and guards non-empty/old files", async () => {
		const files = new Map<string, { file: TFile; content: string }>();
		const templateFile = createMockFile("Templates/daily.md", Date.now() - 60000) as unknown as TFile;
		files.set(templateFile.path, {
			file: templateFile,
			content: "---\ntype: daily\n---\n\n# Template body ignored\n",
		});

		const newNote = createMockFile("Notes/Daily/Untitled.md", Date.now()) as unknown as TFile;
		files.set(newNote.path, { file: newNote, content: "" });

		// Existing collision file to verify -1 suffix
		const existingCollision = createMockFile(
			"Notes/Daily/20261124203000.md",
			Date.now() - 60000
		) as unknown as TFile;
		files.set(existingCollision.path, { file: existingCollision, content: "existing" });

		const operations: string[] = [];
		let createHandler: ((f: unknown) => void) | null = null;

		const mockApp = {
			workspace: {
				onLayoutReady: (cb: () => void) => cb(),
			},
			vault: {
				on: (event: string, cb: (f: unknown) => void) => {
					if (event === "create") createHandler = cb;
					return { event };
				},
				getAbstractFileByPath: (p: string) => files.get(p)?.file ?? null,
				read: async (f: TFile) => files.get(f.path)?.content ?? "",
				modify: async (f: TFile, data: string) => {
					operations.push(`modify:${f.path}`);
					const entry = files.get(f.path);
					if (entry) entry.content = data;
				},
			},
			fileManager: {
				renameFile: async (f: TFile, newPath: string) => {
					operations.push(`rename:${f.path}->${newPath}`);
					const entry = files.get(f.path);
					if (entry) {
						files.delete(f.path);
						f.path = newPath;
						files.set(newPath, entry);
					}
				},
			},
		} as unknown as App;

		const settings: FmatterSettings = {
			...DEFAULT_SETTINGS,
			frontmatterMappings: [
				{ folderPath: "/", templatePath: "Templates/root.md" },
				{ folderPath: "Notes/Daily", templatePath: "Templates/daily.md" },
			],
			timestampFormat: "YYYYMMDDHHmmss",
		};

		const automation = new NewFileAutomation(mockApp, () => settings);
		automation.start(() => {});

		expect(createHandler).not.toBeNull();
		createHandler!(newNote);

		// Flush async microtasks
		await new Promise((r) => setTimeout(r, 20));

		// Must inject Frontmatter BEFORE renaming, and handle collision with -1 suffix
		expect(operations).toEqual([
			"modify:Notes/Daily/Untitled.md",
			"rename:Notes/Daily/Untitled.md->Notes/Daily/20261124203000-1.md",
		]);
		expect(files.get("Notes/Daily/20261124203000-1.md")?.content).toBe("---\ntype: daily\n---\n");

		// Guard test: non-empty or old files must be skipped
		const nonEmptyNote = createMockFile("Notes/Daily/HasContent.md", Date.now()) as unknown as TFile;
		files.set(nonEmptyNote.path, { file: nonEmptyNote, content: "already written" });
		const oldEmptyNote = createMockFile(
			"Notes/Daily/SyncedOld.md",
			Date.now() - 20000
		) as unknown as TFile;
		files.set(oldEmptyNote.path, { file: oldEmptyNote, content: "" });

		createHandler!(nonEmptyNote);
		createHandler!(oldEmptyNote);
		await new Promise((r) => setTimeout(r, 20));

		expect(operations).toHaveLength(2);
		automation.dispose();
	});
});
