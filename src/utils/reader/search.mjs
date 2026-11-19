// Full-text search across every paper, one string per page.
//
// A query is first looked for as written, as one phrase. Only when no page contains the
// phrase are the words looked for separately, on pages that contain all of them. Results
// are grouped by paper, because the question is usually "which papers discuss this".

/**
 * @typedef {object} SearchDocument
 * @property {string} id
 * @property {string} title
 * @property {'zh' | 'original'} variant
 * @property {string[]} pages Text of each page, already cleaned.
 * @property {string[]} [lower] Lower-cased pages, filled in on first use.
 */

export function parseQuery(query) {
	const phrase = query.toLowerCase().replace(/\s+/g, ' ').trim();
	return { phrase, terms: [...new Set(phrase.split(' ').filter(Boolean))] };
}

function countOccurrences(text, needle) {
	let count = 0;
	for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + needle.length)) count++;
	return count;
}

/** The text around the first match, cut into matched and unmatched pieces. */
function excerpt(text, lower, needles) {
	// Lower-casing changes the length of a few characters. Positions found in the
	// lower-cased text are then wrong for the original, so the lower-cased text is shown.
	const shown = text.length === lower.length ? text : lower;

	const first = Math.min(...needles.map((needle) => lower.indexOf(needle)).filter((at) => at !== -1));
	let start = Math.max(0, first - 40);
	let end = Math.min(shown.length, first + 130);
	// Avoid starting or ending inside a Latin word.
	if (start > 0) {
		const space = shown.indexOf(' ', start);
		if (space !== -1 && space < first && space - start < 15) start = space + 1;
	}
	if (end < shown.length) {
		const space = shown.lastIndexOf(' ', end);
		if (space > first + 60) end = space;
	}

	const marks = [];
	for (const needle of needles) {
		for (let at = lower.indexOf(needle, start); at !== -1 && at < end; at = lower.indexOf(needle, at + needle.length)) {
			marks.push([at, Math.min(end, at + needle.length)]);
		}
	}
	marks.sort((a, b) => a[0] - b[0]);

	const segments = [];
	let cursor = start;
	for (const [from, to] of marks) {
		if (from < cursor) continue;
		if (from > cursor) segments.push({ text: shown.slice(cursor, from), match: false });
		segments.push({ text: shown.slice(from, to), match: true });
		cursor = to;
	}
	if (cursor < end) segments.push({ text: shown.slice(cursor, end), match: false });
	return { segments, clippedStart: start > 0, clippedEnd: end < shown.length };
}

function scan(documents, needles, hitsPerPaper) {
	const papers = new Map();
	for (const doc of documents) {
		doc.lower ??= doc.pages.map((page) => page.toLowerCase());
		for (let i = 0; i < doc.pages.length; i++) {
			const lower = doc.lower[i];
			let count = 0;
			let all = true;
			for (const needle of needles) {
				const found = countOccurrences(lower, needle);
				if (!found) {
					all = false;
					break;
				}
				count += found;
			}
			if (!all) continue;

			let paper = papers.get(doc.id);
			if (!paper) papers.set(doc.id, (paper = { id: doc.id, title: doc.title, count: 0, pages: 0, hits: [] }));
			paper.count += count;
			paper.pages++;
			if (paper.hits.length < hitsPerPaper) {
				paper.hits.push({ variant: doc.variant, page: i + 1, count, ...excerpt(doc.pages[i], lower, needles) });
			}
		}
	}
	return papers;
}

/**
 * @param {SearchDocument[]} documents
 * @returns {{ mode: 'phrase' | 'terms', terms: string[], pages: number, papers: object[] }}
 *   `mode` is `terms` when the phrase was not found and the words were matched separately.
 */
export function searchPapers(documents, query, { hitsPerPaper = 12 } = {}) {
	const { phrase, terms } = parseQuery(query);
	if (!phrase) return { mode: 'phrase', terms: [], pages: 0, papers: [] };

	let mode = 'phrase';
	let found = scan(documents, [phrase], hitsPerPaper);
	if (!found.size && terms.length > 1) {
		mode = 'terms';
		found = scan(documents, terms, hitsPerPaper);
	}

	const papers = [...found.values()].sort((a, b) => b.count - a.count || b.id.localeCompare(a.id));
	return {
		mode,
		terms: mode === 'phrase' ? [phrase] : terms,
		pages: papers.reduce((sum, paper) => sum + paper.pages, 0),
		papers,
	};
}
