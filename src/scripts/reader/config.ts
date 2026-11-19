// What the reader page is told about the paper, written into the page by
// PaperReader.astro and read once on start-up.

export interface Chapter {
	title: string;
	page: number;
	level: number;
	/** 0 at the top of the page, 1 at the bottom. */
	y: number;
}

export interface Version {
	/** Shown where the reader switches versions. */
	label: string;
	url: string;
	/** Where the reading position of this file is kept. */
	storageKey: string;
	pages: number;
	outline: Chapter[];
}

export interface ReaderConfig {
	/** URL of the PDF.js character maps, fonts and decoders. */
	assetsUrl: string;
	/** The file this page is for: the translation, or the bilingual copy. */
	main: Version;
	/** The original paper, when the site has it. Absent on the bilingual page. */
	original: Version | null;
	/** Where the original was downloaded from. */
	originalSource: string | null;
	/** A known problem with this file that the reader should hear about. */
	notice: string | null;
}

export function readConfig(): ReaderConfig {
	return JSON.parse(document.getElementById('reader-config')!.textContent!);
}
