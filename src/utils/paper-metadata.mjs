// reading.json: the chapter outline and the original PDF of each published paper.
//
// See docs/paper-reading.md for the format. These checks run in `npm run papers:sync`
// and in every build, so that a paper cannot be published with a missing outline, an
// outline left over from an earlier PDF, or positions measured the wrong way up.

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const SHA256 = /^[a-f0-9]{64}$/;

export function validateReading(meta, pages, id) {
	const fail = (text) => {
		throw new Error(`${id}/reading.json: ${text}`);
	};
	if (meta?.version !== 1 || !SHA256.test(meta.pdfSha256 ?? '')) fail('version=1 and PDF SHA-256 required');

	const check = (outline, count, required = true) => {
		if (!Array.isArray(outline) || (required && outline.length < 2)) {
			fail('explicit chapter outline required (at least two sections)');
		}
		for (const entry of outline) {
			const valid =
				typeof entry.title === 'string' &&
				entry.title.trim() &&
				Number.isInteger(entry.page) &&
				entry.page >= 1 &&
				entry.page <= count &&
				Number.isInteger(entry.level) &&
				entry.level >= 1 &&
				entry.level <= 6 &&
				Number.isFinite(entry.y) &&
				entry.y >= 0 &&
				entry.y <= 1;
			if (!valid) fail('invalid chapter title, page, level or y');
		}
	};

	check(meta.outline, pages);
	if (meta.dualOutline) check(meta.dualOutline, pages);
	if (meta.original) {
		const original = meta.original;
		const valid =
			Number.isInteger(original.pages) &&
			original.pages >= 1 &&
			SHA256.test(original.sha256 ?? '') &&
			typeof original.file === 'string' &&
			!path.isAbsolute(original.file) &&
			!original.file.split(/[\\/]/).includes('..') &&
			original.file.endsWith('.pdf') &&
			/^https:\/\//.test(original.sourceUrl ?? '');
		if (!valid) fail('invalid original PDF metadata');
		check(original.outline, original.pages, false);
	}
	return meta;
}

/**
 * Compares an outline with the bookmarks of its PDF.
 *
 * Most outlines start as a copy of the bookmarks. When an outline still lines up with
 * them entry by entry, its vertical positions have to agree as well. This catches `y`
 * written the PDF way, from the bottom of the page, which sends every jump to the
 * mirrored place.
 *
 * Outlines written or rearranged by hand no longer line up and are left alone.
 */
export function checkOutlineAgainstBookmarks(outline, bookmarks, label) {
	if (!bookmarks.length || bookmarks.length !== outline.length) return;
	if (outline.some((entry, i) => entry.page !== bookmarks[i].page)) return;

	const off = outline.findIndex((entry, i) => Math.abs(entry.y - bookmarks[i].y) > 0.03);
	if (off === -1) return;

	const entry = outline[off];
	const mirrored = outline.every((item, i) => Math.abs(item.y - (1 - bookmarks[i].y)) <= 0.03 || bookmarks[i].y === 0);
	throw new Error(
		`${label}: "${entry.title}" has y=${entry.y}, but the PDF places it at ${bookmarks[off].y} from the top of page ${entry.page}. ` +
			(mirrored ? 'The outline looks measured from the bottom of the page; y is 0 at the top and 1 at the bottom. ' : '') +
			'Run `npm run papers:outline -- --write` for this paper, or correct the entry.',
	);
}

export async function readReading(root, paper, verify = false) {
	const archive = path.join(root, 'paper-translations');
	const location = path.join(archive, path.dirname(paper.pdf), 'reading.json');
	let meta;
	try {
		meta = JSON.parse(await readFile(location, 'utf8'));
	} catch {
		throw new Error(`${paper.id}: missing/invalid reading.json. Supply explicit chapters; see docs/paper-reading.md.`);
	}
	validateReading(meta, paper.pages, paper.id);
	if (paper.dual && (!meta.dualOutline?.length || !SHA256.test(meta.dualSha256 ?? ''))) {
		throw new Error(`${paper.id}: dual PDF requires dualOutline and dualSha256`);
	}
	if (verify) {
		const files = [[paper.pdf, meta.pdfSha256]];
		if (paper.dual) files.push([paper.dual, meta.dualSha256]);
		if (meta.original) files.push([meta.original.file, meta.original.sha256]);
		for (const [file, expected] of files) {
			const actual = createHash('sha256').update(await readFile(path.join(archive, file))).digest('hex');
			if (actual !== expected) {
				throw new Error(`${paper.id}: PDF changed; recheck chapter page positions and update reading.json SHA-256`);
			}
		}
	}
	return meta;
}
