// Text clean-up shared by the reader (copying), the search index and the tests.
//
// Text taken out of a PDF comes one typeset line at a time: paragraphs are broken at
// every line end, Chinese characters are separated by stray spaces, and long words are
// hyphenated across lines. These helpers turn that back into running text.

const CJK = '\\p{Script=Han}\\u3000-\\u303f\\uff00-\\uffef';
const CJK_BEFORE_SPACE = new RegExp(`(?<=[${CJK}]) +(?=[${CJK}])`, 'gu');
const ENDS_CJK = new RegExp(`[${CJK}]$`, 'u');
const STARTS_CJK = new RegExp(`^[${CJK}]`, 'u');
const ENDS_HAN = /\p{Script=Han}$/u;
const STARTS_HAN = /^\p{Script=Han}/u;
const ENDS_CJK_PUNCTUATION = /[\u3000-\u303f\uff00-\uffef]$/u;
const STARTS_CJK_PUNCTUATION = /^[\u3000-\u303f\uff00-\uffef]/u;
const ENDS_WORD_HYPHEN = /[\p{L}\p{N}]-$/u;
const STARTS_WORD = /^[\p{L}\p{N}]/u;
const STARTS_LOWERCASE = /^\p{Ll}/u;
// A sentence end, optionally followed by a footnote mark.
const ENDS_SENTENCE = /[。．.!?！？:：;；…」』”"')）\]][\d*†‡¹²³⁴⁵⁶⁷⁸⁹⁰]{0,3}$/u;

/** Collapses runs of spaces and removes the ones extraction puts inside Chinese text. */
export function tidySpaces(text) {
	return text
		.replace(/[ \t\u00a0]+/g, ' ')
		.replace(CJK_BEFORE_SPACE, '')
		.trim();
}

/**
 * Joins two consecutive typeset lines of one paragraph.
 *
 * A hyphen at the line end is kept ("state-\nspace" is "state-space") unless
 * `dehyphenate` is set, which suits searching: there "ma-\nchine" has to match "machine".
 */
export function joinWrapped(first, second, { dehyphenate = false } = {}) {
	const a = first.trimEnd();
	const b = second.trimStart();
	if (!a) return b;
	if (!b) return a;
	// A soft hyphen only marks where a word may break.
	if (a.endsWith('\u00ad')) return a.slice(0, -1) + b;
	if (ENDS_WORD_HYPHEN.test(a) && STARTS_WORD.test(b)) {
		return dehyphenate && STARTS_LOWERCASE.test(b) ? a.slice(0, -1) + b : a + b;
	}
	// Chinese runs straight on. Between Chinese and Latin text the typeset line has a space.
	const closeUp =
		(ENDS_HAN.test(a) && STARTS_HAN.test(b)) || ENDS_CJK_PUNCTUATION.test(a) || STARTS_CJK_PUNCTUATION.test(b);
	return closeUp ? a + b : `${a} ${b}`;
}

/**
 * Cleans text whose paragraphs are separated by blank lines: single line breaks are
 * treated as typesetting and removed.
 */
export function cleanText(text, options) {
	return text
		.replace(/\r\n?/g, '\n')
		.split(/\n[ \t]*\n+/)
		.map((paragraph) => tidySpaces(paragraph.split('\n').reduce((joined, line) => joinWrapped(joined, line, options), '')))
		.filter(Boolean)
		.join('\n\n');
}

const median = (values) => {
	const sorted = [...values].sort((a, b) => a - b);
	return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
};

/**
 * Rebuilds paragraphs from typeset lines, using where each line sits on the page.
 *
 * A PDF has no paragraph marks, so they are inferred: a paragraph ends where the next
 * line starts after a larger gap than usual, or where a line stops short of the right
 * margin at the end of a sentence.
 *
 * @param {{ text: string, top: number, left: number, right: number, height: number, page?: number }[]} lines
 *   In reading order. `top` grows downwards within a page; the unit does not matter.
 */
export function joinLines(lines, options) {
	const rows = lines.filter((line) => line.text.trim());
	if (!rows.length) return '';

	const height = median(rows.map((row) => row.height)) || 1;
	const steps = [];
	for (let i = 1; i < rows.length; i++) {
		const step = rows[i].top - rows[i - 1].top;
		if (rows[i].page === rows[i - 1].page && step > 0.6 * height && step < 3 * height) steps.push(step);
	}
	const pitch = steps.length >= 2 ? median(steps) : 1.25 * height;
	// The right margin of the column a line is in: the widest line starting near the
	// same left edge. Comparing with the whole page would make every line of a left
	// column look short.
	const marginOf = (row) =>
		Math.max(...rows.filter((other) => Math.abs(other.left - row.left) < 4 * height).map((other) => other.right));
	const stopsShort = (row) => row.right < marginOf(row) - 2 * height;

	const paragraphs = [];
	let current = rows[0].text;
	for (let i = 1; i < rows.length; i++) {
		const previous = rows[i - 1];
		const step = rows[i].top - previous.top;
		const samePage = rows[i].page === previous.page;
		let ends;
		if (samePage && Math.abs(step) < 0.6 * pitch) {
			// The same visual line, split by a subscript or a formula fragment.
			ends = false;
		} else if (samePage && step > 1.45 * pitch) {
			ends = true;
		} else {
			// The next line follows directly, or continues in the next column or page.
			ends = stopsShort(previous) && ENDS_SENTENCE.test(previous.text.trimEnd());
		}
		if (ends) {
			paragraphs.push(current);
			current = rows[i].text;
		} else {
			current = joinWrapped(current, rows[i].text, options);
		}
	}
	paragraphs.push(current);
	return paragraphs.map(tidySpaces).filter(Boolean).join('\n\n');
}

/**
 * Text of one page for the search index, from PDF.js text items.
 * Words hyphenated across lines are rejoined so that they can be found.
 */
export function searchableText(items) {
	let text = '';
	let line = '';
	for (const item of items) {
		line += item.str;
		if (item.hasEOL) {
			text = joinWrapped(text, line, { dehyphenate: true });
			line = '';
		}
	}
	return tidySpaces(joinWrapped(text, line, { dehyphenate: true }));
}
