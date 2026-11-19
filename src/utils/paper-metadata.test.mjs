import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkOutlineAgainstBookmarks, readReading, validateReading } from './paper-metadata.mjs';

const chapter = (title, page, y, level = 1) => ({ title, page, y, level });

test('publication rejects missing chapters, out-of-range pages and a missing hash', () => {
	const good = { version: 1, pdfSha256: 'a'.repeat(64), outline: [chapter('引言', 1, 0.2), chapter('方法', 3, 0.2)], original: null };
	assert.doesNotThrow(() => validateReading(good, 10, 'test'));
	assert.throws(() => validateReading({ ...good, outline: [] }, 10, 'test'), /at least two sections/);
	assert.throws(() => validateReading(good, 2, 'test'), /invalid chapter/);
	assert.throws(() => validateReading({ ...good, outline: [chapter('引言', 1, 1.2), chapter('方法', 3, 0.2)] }, 10, 'test'));
	assert.throws(() => validateReading({ ...good, pdfSha256: '' }, 10, 'test'), /SHA-256/);
});

test('the original needs a relative PDF path, a hash and an https source', () => {
	const base = { version: 1, pdfSha256: 'a'.repeat(64), outline: [chapter('引言', 1, 0.2), chapter('方法', 3, 0.2)] };
	const original = { file: 'x/paper.en.pdf', pages: 8, sha256: 'b'.repeat(64), sourceUrl: 'https://arxiv.org/pdf/1', outline: [] };
	assert.doesNotThrow(() => validateReading({ ...base, original }, 10, 'test'));
	assert.throws(() => validateReading({ ...base, original: { ...original, file: '../x.pdf' } }, 10, 'test'));
	assert.throws(() => validateReading({ ...base, original: { ...original, file: '/abs/x.pdf' } }, 10, 'test'));
	assert.throws(() => validateReading({ ...base, original: { ...original, sourceUrl: 'http://arxiv.org' } }, 10, 'test'));
	assert.throws(() => validateReading({ ...base, original: { ...original, outline: [chapter('Intro', 9, 0)] } }, 10, 'test'));
});

test('a changed PDF must not publish with the old outline', async () => {
	const root = await mkdtemp(path.join(tmpdir(), 'paper-metadata-'));
	const dir = path.join(root, 'paper-translations', 'test');
	try {
		await mkdir(dir, { recursive: true });
		const paper = { id: 'test', pdf: 'test/paper.zh.pdf', pages: 3 };
		await assert.rejects(() => readReading(root, paper, true), /missing\/invalid/);

		await writeFile(path.join(dir, 'paper.zh.pdf'), 'first PDF bytes');
		const pdfSha256 = createHash('sha256').update('first PDF bytes').digest('hex');
		const meta = { version: 1, pdfSha256, outline: [chapter('Intro', 1, 0), chapter('Method', 2, 0)], original: null };
		await writeFile(path.join(dir, 'reading.json'), JSON.stringify(meta));
		await readReading(root, paper, true);

		await writeFile(path.join(dir, 'paper.zh.pdf'), 'new PDF bytes');
		await assert.rejects(() => readReading(root, paper, true), /PDF changed/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('an outline measured from the bottom of the page is refused', () => {
	const bookmarks = [chapter('引言', 1, 0.56), chapter('方法', 2, 0.18), chapter('实验', 4, 0.69)];
	assert.doesNotThrow(() => checkOutlineAgainstBookmarks(bookmarks, bookmarks, 'test'));
	// Retitled by hand, positions within a line of the bookmark: fine.
	const retitled = bookmarks.map((entry) => ({ ...entry, title: entry.title + '（译）', y: entry.y + 0.01 }));
	assert.doesNotThrow(() => checkOutlineAgainstBookmarks(retitled, bookmarks, 'test'));

	const upsideDown = bookmarks.map((entry) => ({ ...entry, y: Math.round((1 - entry.y) * 100) / 100 }));
	assert.throws(() => checkOutlineAgainstBookmarks(upsideDown, bookmarks, 'test'), /measured from the bottom/);

	const oneOff = bookmarks.map((entry, i) => (i === 1 ? { ...entry, y: 0.6 } : entry));
	assert.throws(() => checkOutlineAgainstBookmarks(oneOff, bookmarks, 'test'), /"方法" has y=0.6, but the PDF places it at 0.18/);
});

test('outlines written by hand are not compared with the bookmarks', () => {
	const bookmarks = [chapter('Intro', 1, 0.5), chapter('Method', 2, 0.2), chapter('Results', 4, 0.7)];
	// No bookmarks in the PDF, a different number of entries, or different pages.
	assert.doesNotThrow(() => checkOutlineAgainstBookmarks([chapter('引言', 1, 0.9), chapter('方法', 2, 0.9)], [], 'test'));
	assert.doesNotThrow(() => checkOutlineAgainstBookmarks(bookmarks.slice(0, 2).map((entry) => ({ ...entry, y: 0.99 })), bookmarks, 'test'));
	const otherPages = bookmarks.map((entry) => ({ ...entry, page: entry.page + 1, y: 0.99 }));
	assert.doesNotThrow(() => checkOutlineAgainstBookmarks(otherPages, bookmarks, 'test'));
});
