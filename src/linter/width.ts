/**
 * Calculate monospace display width of a string using East Asian Width rules.
 * - Fullwidth / Wide (CJK, fullwidth punctuation, kana, hangul, wide emoji): 2
 * - Zero-width (combining marks, ZWJ, variation selectors, control chars): 0
 * - Narrow / Halfwidth / ASCII: 1
 */
export function getDisplayWidth(text: string): number {
	let width = 0;
	let prevWasZwj = false;

	for (const ch of text) {
		const cp = ch.codePointAt(0);
		if (cp === undefined) {
			continue;
		}

		if (cp === 0x200d) {
			prevWasZwj = true;
			continue;
		}

		if (isZeroWidthCodePoint(cp)) {
			continue;
		}

		if (prevWasZwj) {
			prevWasZwj = false;
			continue;
		}

		width += isFullWidthCodePoint(cp) ? 2 : 1;
	}

	return width;
}

function isZeroWidthCodePoint(cp: number): boolean {
	return (
		cp <= 0x1f ||
		(cp >= 0x7f && cp <= 0x9f) ||
		cp === 0x00ad ||
		(cp >= 0x0300 && cp <= 0x036f) ||
		(cp >= 0x1ab0 && cp <= 0x1aff) ||
		(cp >= 0x1dc0 && cp <= 0x1dff) ||
		(cp >= 0x200b && cp <= 0x200f) ||
		(cp >= 0x202a && cp <= 0x202e) ||
		(cp >= 0x2060 && cp <= 0x206f) ||
		(cp >= 0x20d0 && cp <= 0x20ff) ||
		(cp >= 0xfe00 && cp <= 0xfe0f) ||
		(cp >= 0xfe20 && cp <= 0xfe2f) ||
		cp === 0xfeff ||
		(cp >= 0x1f3fb && cp <= 0x1f3ff) ||
		(cp >= 0xe0100 && cp <= 0xe01ef)
	);
}

function isFullWidthCodePoint(cp: number): boolean {
	if (cp < 0x1100) {
		return false;
	}

	return (
		// Hangul Jamo
		(cp >= 0x1100 && cp <= 0x115f) ||
		// Angle brackets
		cp === 0x2329 ||
		cp === 0x232a ||
		// Common wide symbols / Emoji in BMP
		(cp >= 0x231a && cp <= 0x231b) ||
		(cp >= 0x23e9 && cp <= 0x23f3) ||
		(cp >= 0x23f8 && cp <= 0x23fa) ||
		(cp >= 0x25fd && cp <= 0x25fe) ||
		(cp >= 0x2614 && cp <= 0x2615) ||
		(cp >= 0x2648 && cp <= 0x2653) ||
		cp === 0x267f ||
		cp === 0x2693 ||
		cp === 0x26a1 ||
		(cp >= 0x26aa && cp <= 0x26ab) ||
		(cp >= 0x26bd && cp <= 0x26be) ||
		(cp >= 0x26c4 && cp <= 0x26c5) ||
		cp === 0x26ce ||
		cp === 0x26d4 ||
		cp === 0x26ea ||
		(cp >= 0x26f2 && cp <= 0x26f3) ||
		cp === 0x26f5 ||
		cp === 0x26fa ||
		cp === 0x26fd ||
		cp === 0x2705 ||
		(cp >= 0x270a && cp <= 0x270b) ||
		cp === 0x2728 ||
		cp === 0x274c ||
		cp === 0x274e ||
		(cp >= 0x2753 && cp <= 0x2755) ||
		cp === 0x2757 ||
		(cp >= 0x2795 && cp <= 0x2797) ||
		cp === 0x27b0 ||
		cp === 0x27bf ||
		(cp >= 0x2b1b && cp <= 0x2b1c) ||
		cp === 0x2b50 ||
		cp === 0x2b55 ||
		// CJK Radicals .. Yi Syllables & Radicals (excluding U+303F halfwidth fill)
		(cp >= 0x2e80 && cp <= 0x303e) ||
		(cp >= 0x3041 && cp <= 0x33ff) ||
		// CJK Extension A
		(cp >= 0x3400 && cp <= 0x4dbf) ||
		// CJK Unified Ideographs
		(cp >= 0x4e00 && cp <= 0xa4cf) ||
		// Hangul Jamo Extended-A
		(cp >= 0xa960 && cp <= 0xa97f) ||
		// Hangul Syllables
		(cp >= 0xac00 && cp <= 0xd7a3) ||
		// CJK Compatibility Ideographs
		(cp >= 0xf900 && cp <= 0xfaff) ||
		// Vertical Forms
		(cp >= 0xfe10 && cp <= 0xfe19) ||
		// CJK Compatibility Forms & Small Form Variants
		(cp >= 0xfe30 && cp <= 0xfe6f) ||
		// Fullwidth ASCII & Punctuation
		(cp >= 0xff01 && cp <= 0xff60) ||
		(cp >= 0xffe0 && cp <= 0xffe6) ||
		// Kana Supplement & Extended
		(cp >= 0x1b000 && cp <= 0x1b12f) ||
		// Enclosed Ideographic & Emoji blocks
		cp === 0x1f004 ||
		cp === 0x1f0cf ||
		cp === 0x1f18e ||
		(cp >= 0x1f191 && cp <= 0x1f19a) ||
		(cp >= 0x1f200 && cp <= 0x1f2ff) ||
		(cp >= 0x1f300 && cp <= 0x1f64f) ||
		(cp >= 0x1f680 && cp <= 0x1f6ff) ||
		(cp >= 0x1f900 && cp <= 0x1f9ff) ||
		(cp >= 0x1fa70 && cp <= 0x1faff) ||
		// CJK Unified Ideographs Extension B..G & Tertiary Ideographic Plane
		(cp >= 0x20000 && cp <= 0x3fffd)
	);
}
