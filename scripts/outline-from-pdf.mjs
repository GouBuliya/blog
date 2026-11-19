#!/usr/bin/env node
// Drafts or refreshes the chapter outlines in reading.json from the bookmarks of the PDFs.
//
//   npm run papers:outline                    report what would change, for every paper
//   npm run papers:outline -- 2609.36529      only these papers
//   npm run papers:outline -- --write         apply the changes
//
// For the translation, the original and the bilingual copy of each paper:
//
// - an empty outline is filled from the bookmarks;
// - an outline that lines up with the bookmarks, entry by entry and page by page, has
//   its vertical positions refreshed. Titles and levels are kept as they are;
// - any other outline was written or rearranged by hand and is left alone.
//
// A new paper still needs a reading.json with its hashes first; see docs/paper-reading.md.
// The result is a draft: check titles and positions in the reader before publishing.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readBookmarks, withPdf } from '../src/utils/pdf-inspect.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const archive = path.join(root, 'paper-translations');

const args = process.argv.slice(2);
const write = args.includes('--write');
const only = new Set(args.filter((arg) => !arg.startsWith('--')));

const papers = JSON.parse(await readFile(path.join(root, 'src/data/papers.json'), 'utf8'));
const unknown = [...only].filter((id) => !papers.some((paper) => paper.id === id));
if (unknown.length) {
	console.error(`Not in src/data/papers.json: ${unknown.join(', ')}`);
	process.exit(1);
}

/** Returns the outline to store and a note on what happened. */
function refresh(outline, bookmarks) {
	if (!bookmarks.length) return { outline, note: 'no bookmarks in the PDF; kept as written' };
	if (!outline.length) return { outline: bookmarks, note: `filled with ${bookmarks.length} bookmarks`, changed: true };

	const aligned = outline.length === bookmarks.length && outline.every((entry, i) => entry.page === bookmarks[i].page);
	if (!aligned) {
		return { outline, note: `${outline.length} entries do not line up with ${bookmarks.length} bookmarks; kept as written` };
	}

	const moved = outline.filter((entry, i) => entry.y !== bookmarks[i].y).length;
	if (!moved) return { outline, note: 'up to date' };
	return {
		outline: outline.map((entry, i) => ({ ...entry, y: bookmarks[i].y })),
		note: `${moved} of ${outline.length} positions corrected`,
		changed: true,
	};
}

let changedFiles = 0;
for (const paper of papers) {
	if (only.size && !only.has(paper.id)) continue;

	const location = path.join(archive, path.dirname(paper.pdf), 'reading.json');
	const meta = JSON.parse(await readFile(location, 'utf8'));

	const targets = [['translation', paper.pdf, () => meta.outline, (value) => (meta.outline = value)]];
	if (meta.original) {
		targets.push(['original', meta.original.file, () => meta.original.outline, (value) => (meta.original.outline = value)]);
	}
	if (paper.dual) {
		targets.push(['bilingual', paper.dual, () => meta.dualOutline ?? [], (value) => (meta.dualOutline = value)]);
	}

	let changed = false;
	const notes = [];
	for (const [name, file, get, set] of targets) {
		const bookmarks = await withPdf(path.join(archive, file), readBookmarks);
		const result = refresh(get(), bookmarks);
		if (result.changed) {
			set(result.outline);
			changed = true;
		}
		notes.push(`${name}: ${result.note}`);
	}

	console.log(`${changed ? (write ? 'updated ' : 'would update ') : ''}${paper.id}\n  ${notes.join('\n  ')}`);
	if (changed) {
		changedFiles++;
		if (write) await writeFile(location, JSON.stringify(meta, null, 2) + '\n');
	}
}

console.log(
	changedFiles
		? write
			? `\nUpdated ${changedFiles} reading.json file(s).`
			: `\n${changedFiles} reading.json file(s) would change. Run again with --write to apply.`
		: '\nNothing to change.',
);
