import catalog from '../data/papers.json';

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
}

// arXiv identifiers start with the submission month, so sorting them in reverse
// puts the most recent papers first. Papers without one follow, ordered by title.
const ARXIV_ID = /^\d{4}\.\d{4,5}$/;

export const papers: Paper[] = catalog
	.map((entry) => ({
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
export const pdfjsAssetsUrl = `${base}/pdfjs/`;

export const hasArxivId = (paper: Paper) => ARXIV_ID.test(paper.id);

export function formatSize(bytes: number) {
	return `${(bytes / 1e6).toFixed(1)} MB`;
}
