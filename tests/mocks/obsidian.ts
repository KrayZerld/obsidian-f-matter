export class TFile {
	path: string;
	basename: string;
	extension: string;
	parent: { path: string } | null;
	stat: { ctime: number; mtime: number; size: number };

	constructor(path = "", ctime = Date.now()) {
		this.path = path;
		const lastSlash = path.lastIndexOf("/");
		const fileName = lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
		const dot = fileName.lastIndexOf(".");
		this.basename = dot >= 0 ? fileName.slice(0, dot) : fileName;
		this.extension = dot >= 0 ? fileName.slice(dot + 1) : "";
		this.parent = lastSlash >= 0 ? { path: path.slice(0, lastSlash) } : { path: "/" };
		this.stat = { ctime, mtime: ctime, size: 0 };
	}
}

export function createMockFile(path: string, ctime = Date.now()): TFile {
	return new TFile(path, ctime);
}

export function moment() {
	return {
		format(fmt: string): string {
			if (fmt === "YYYYMMDDHHmmss") {
				return "20261124203000";
			}
			return fmt;
		},
	};
}
