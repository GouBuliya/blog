// Chapter outlines: finding the chapter being read, and matching positions between the
// translation and the original.
//
// An outline entry is `{ title, page, level, y }`, with `y` measured like a reading
// position: 0 at the top of the page, 1 at the bottom.

import { toOffset } from './position.mjs';

/**
 * Index of the chapter the reader is in, or -1 before the first one.
 *
 * A heading counts as reached once it is at, or just below, the top of the screen.
 * Entries are taken in list order and the scan stops at the first heading not reached:
 * in a two-column paper a later chapter can start higher on the page than an earlier one.
 */
export function currentChapter(outline, position) {
	let current = -1;
	for (let i = 0; i < outline.length; i++) {
		const entry = outline[i];
		const reached = entry.page < position.page || (entry.page === position.page && entry.y <= position.y + 0.12);
		if (!reached) break;
		current = i;
	}
	return current;
}

/**
 * Pairs of matching places in two outlines of the same paper, as `[offsetA, offsetB]`
 * in pages from the start, including both ends of the documents.
 *
 * Chapters are matched by their place in the list, which is only meaningful when both
 * outlines have the same shape. Returns null otherwise; the caller then has nothing
 * better than the overall proportion.
 */
export function alignOutlines(a, b, pagesA, pagesB) {
	if (a.length < 2 || a.length !== b.length) return null;
	const sameLevel = a.filter((entry, i) => entry.level === b[i].level).length;
	if (sameLevel < 0.8 * a.length) return null;

	const pairs = [[0, 0]];
	for (let i = 0; i < a.length; i++) {
		const pair = [toOffset(a[i]), toOffset(b[i])];
		const last = pairs[pairs.length - 1];
		// Offsets have to grow on both sides for the mapping to be usable in both
		// directions. Two-column layouts break that now and then; those entries are skipped.
		if (pair[0] > last[0] && pair[1] > last[1] && pair[0] < pagesA && pair[1] < pagesB) pairs.push(pair);
	}
	pairs.push([pagesA, pagesB]);
	return pairs.length >= 4 ? pairs : null;
}

/**
 * Maps an offset in document A to the matching offset in document B.
 *
 * @param {number[][] | null} pairs From `alignOutlines`, or null to use the proportion.
 * @param {boolean} reverse Map from B to A instead.
 */
export function mapOffset(pairs, offset, pagesA, pagesB, reverse = false) {
	const [from, to] = reverse ? [1, 0] : [0, 1];
	const totals = [pagesA, pagesB];
	if (!pairs) return (offset / totals[from]) * totals[to];

	let i = 1;
	while (i < pairs.length - 1 && pairs[i][from] <= offset) i++;
	const start = pairs[i - 1];
	const end = pairs[i];
	const span = end[from] - start[from];
	const progress = span > 0 ? (offset - start[from]) / span : 0;
	return start[to] + Math.min(1, Math.max(0, progress)) * (end[to] - start[to]);
}
