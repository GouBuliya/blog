// Builds the full-text search index and, in the same pass over the PDFs, checks each
// outline against the bookmarks of its file.
//
// The text is taken out of the PDFs at build time, so that searching in the browser
// needs neither the PDF library nor the PDFs. There is one index per language: the
// translations are searched by default and the originals only on request, which
// keeps the first search to about a third of the download.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { checkOutlineAgainstBookmarks, readReading } from '../utils/paper-metadata.mjs';
import { readBookmarks, readPageTexts, withPdf } from '../utils/pdf-inspect.mjs';
import { tidySpaces } from '../utils/reader/text.mjs';

/** Names of the index files, by language. */
export const SEARCH_INDEX_FILES = { zh: 'paper-search.zh.json', original: 'paper-search.original.json' };

/**
 * A reviewed transcript for PDFs whose pages are scanned images: `search-text.json`
 * beside the PDF, one string per physical page. Null when there is none.
 */
async function readTranscript(pdfFile, pages, id) {
	let transcript;
	try {
		transcript = JSON.parse(await readFile(path.join(path.dirname(pdfFile), 'search-text.json'), 'utf8'));
	} catch (error) {
		if (error.code === 'ENOENT') return null;
		throw error;
	}
	if (!Array.isArray(transcript) || transcript.length !== pages || transcript.some((text) => typeof text !== 'string')) {
		throw new Error(`${id}: search-text.json must list one string for each of the ${pages} pages`);
	}
	return transcript.map(tidySpaces);
}

/** @returns {Promise<{ zh: object[], original: object[] }>} */
export async function buildSearchIndex(root) {
	const archive = path.join(root, 'paper-translations');
	const papers = JSON.parse(await readFile(path.join(root, 'src/data/papers.json'), 'utf8'));
	const index = { zh: [], original: [] };

	for (const paper of papers) {
		const meta = await readReading(root, paper);
		const variants = [{ variant: 'zh', file: paper.pdf, pages: paper.pages, outline: meta.outline }];
		if (meta.original) {
			variants.push({ variant: 'original', file: meta.original.file, pages: meta.original.pages, outline: meta.original.outline });
		}

		for (const { variant, file, pages, outline } of variants) {
			const location = path.join(archive, file);
			const texts = await withPdf(location, async (pdf) => {
				if (pdf.numPages !== pages) {
					throw new Error(`${paper.id}: ${file} has ${pdf.numPages} pages, but ${pages} are recorded. Run \`npm run papers:sync\`.`);
				}
				checkOutlineAgainstBookmarks(outline, await readBookmarks(pdf), `${paper.id} (${variant})`);
				const transcript = variant === 'zh' ? await readTranscript(location, pages, paper.id) : null;
				return transcript ?? (await readPageTexts(pdf));
			});
			index[variant].push({ id: paper.id, title: paper.title, variant, pages: texts });
		}
	}
	return index;
}
