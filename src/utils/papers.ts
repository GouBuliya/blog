import catalog from '../data/papers.json';
import { readReading } from './paper-metadata.mjs';

export interface Chapter {
	title: string;
	/** 1-based physical page of the PDF. */
	page: number;
	level: number;
	/** Where the heading is on the page: 0 at the top, 1 at the bottom. */
	y: number;
}

/** reading.json: what the reader needs beyond the PDF. See docs/paper-reading.md. */
export interface Reading {
	outline: Chapter[];
	/** Chapters of the bilingual copy, which has its own page layout. */
	dualOutline?: Chapter[];
	/** The original paper, kept beside the translation for comparing the two. */
	original: null | { file: string; pages: number; sourceUrl: string; outline: Chapter[] };
	/** A known problem with the translated file, shown to the reader. */
	notice?: string;
}

export interface Paper {
	id: string;
	title: string;
	pages: number;
	/** `latex`: translated from the LaTeX source. `local`: a translated PDF of unverified origin. */
	kind: 'latex' | 'local';
	arxiv: string | null;
	/** File name under /paper-files/. */
	file: string;
	bytes: number;
	/** The only available copy shows the original and the translation side by side. */
	bilingual: boolean;
	dualFile: string | null;
	dualBytes: number | null;
	reading: Reading;
}

// arXiv identifiers start with the submission month, so sorting them in reverse
// puts the most recent papers first. Papers without one follow, ordered by title.
const ARXIV_ID = /^\d{4}\.\d{4,5}$/;

const readings: Reading[] = await Promise.all(catalog.map((entry) => readReading(process.cwd(), entry)));
export const papers: Paper[] = catalog
	.map((entry, index) => ({
		id: entry.id,
		title: entry.title,
		pages: entry.pages,
		kind: entry.kind as Paper['kind'],
		arxiv: entry.arxiv,
		file: entry.file,
		bytes: entry.bytes,
		bilingual: entry.bilingual,
		dualFile: entry.dualFile,
		dualBytes: entry.dualBytes,
		reading: readings[index],
	}))
	.sort((a, b) => {
		const aDated = ARXIV_ID.test(a.id);
		const bDated = ARXIV_ID.test(b.id);
		if (aDated && bDated) return b.id.localeCompare(a.id);
		if (aDated !== bDated) return aDated ? -1 : 1;
		return a.title.localeCompare(b.title, 'zh-CN');
	});

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export const paperListUrl = `${base}/papers/`;
export const paperUrl = (id: string) => `${base}/papers/${id}/`;
export const readerUrl = (id: string, variant: 'zh' | 'dual' = 'zh') =>
	`${base}/papers/${id}/${variant === 'dual' ? 'dual' : 'read'}/`;
export const fileUrl = (name: string) => `${base}/paper-files/${name}`;
/** File name under /paper-files/ of the original paper. Matches src/integrations/papers.mjs. */
export const originalFileName = (paper: Paper) => `${paper.id}.original.pdf`;
export const searchIndexUrl = (language: 'zh' | 'original') => `${base}/paper-search.${language}.json`;
export const pdfjsAssetsUrl = `${base}/pdfjs/`;

export const hasArxivId = (paper: Paper) => ARXIV_ID.test(paper.id);

export function formatSize(bytes: number) {
	return `${(bytes / 1e6).toFixed(1)} MB`;
}
