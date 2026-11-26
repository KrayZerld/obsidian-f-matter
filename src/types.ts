export interface LinterSettings {
	autoBlankLine: boolean;
	autoSpacing: boolean;
	tableAlign: boolean;
}

export interface FrontmatterMapping {
	folderPath: string;
	templatePath: string;
}

export interface FmatterSettings {
	linter: LinterSettings;
	frontmatterMappings: FrontmatterMapping[];
	timestampFormat: string;
}

export const DEFAULT_SETTINGS: FmatterSettings = {
	linter: {
		autoBlankLine: true,
		autoSpacing: true,
		tableAlign: true,
	},
	frontmatterMappings: [],
	timestampFormat: "",
};
