// Reads the PDFs in Node: bookmarks and page text.
//
// Used by the outline tool, the publication checks and the search index. The browser
// never does this; the reader is given the chapters from reading.json.

import { readFile } from 'node:fs/promises';
import { searchableText } from './reader/text.mjs';

let pdfjs;

/** Opens a PDF, passes the document to `use`, and closes it again. */
export async function withPdf(file, use) {
	pdfjs ??= await import('pdfjs-dist/legacy/build/pdf.mjs');
	const task = pdfjs.getDocument({ data: new Uint8Array(await readFile(file)), useSystemFonts: true, verbosity: 0 });
	try {
		return await use(await task.promise);
	} finally {
		await task.destroy();
	}
}

/**
 * The bookmarks of a PDF as outline entries `{ title, page, level, y }`.
 *
 * `y` is where the bookmark points on its page, from 0 at the top to 1 at the bottom.
 * PDF coordinates run the other way, from the bottom of the page upwards, so the value
 * is flipped here, once.
 */
export async function readBookmarks(pdf) {
	const entries = [];

	async function walk(items, level) {
		for (const item of items ?? []) {
			let dest = item.dest;
			if (typeof dest === 'string') dest = await pdf.getDestination(dest);
			if (Array.isArray(dest)) {
				const pageIndex = typeof dest[0] === 'object' ? await pdf.getPageIndex(dest[0]) : dest[0];
				const page = await pdf.getPage(pageIndex + 1);
				const [, bottom, , top] = page.view;
				const kind = dest[1]?.name;
				const target = kind === 'XYZ' ? dest[3] : kind === 'FitH' || kind === 'FitBH' ? dest[2] : null;
				// Without a vertical target, or on a rotated page, the bookmark means the page.
				const y = typeof target === 'number' && page.rotate === 0 ? 1 - (target - bottom) / (top - bottom) : 0;
				entries.push({
					title: item.title.replace(/\s+/g, ' ').trim(),
					page: pageIndex + 1,
					level: Math.min(level, 6),
					y: Math.round(Math.min(1, Math.max(0, y)) * 1e5) / 1e5,
				});
			}
			await walk(item.items, level + 1);
		}
	}

	await walk(await pdf.getOutline(), 1);
	return entries;
}

/** The text of every page, cleaned for searching. */
export async function readPageTexts(pdf) {
	const pages = [];
	for (let number = 1; number <= pdf.numPages; number++) {
		const page = await pdf.getPage(number);
		pages.push(searchableText((await page.getTextContent()).items));
	}
	return pages;
}
