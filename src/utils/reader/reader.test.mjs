import assert from 'node:assert/strict';
import test from 'node:test';
import { alignOutlines, currentChapter, mapOffset } from './outline.mjs';
import { formatPosition, fromOffset, parsePosition, toOffset } from './position.mjs';
import { parseQuery, searchPapers } from './search.mjs';
import { cleanText, joinLines, joinWrapped, searchableText } from './text.mjs';

// --- text ---------------------------------------------------------------------------

test('wrapped lines join the way the paragraph was written', () => {
	assert.equal(joinWrapped('进行可', '学习的线性投影'), '进行可学习的线性投影');
	assert.equal(joinWrapped('用于更新', 'token 表示'), '用于更新 token 表示');
	assert.equal(joinWrapped('通过对 x', '进行投影'), '通过对 x 进行投影');
	assert.equal(joinWrapped('写入循环状态，', 'then read'), '写入循环状态，then read');
	assert.equal(joinWrapped('a state-', 'space model'), 'a state-space model');
	assert.equal(joinWrapped('atten\u00ad', 'tion'), 'attention');
	assert.equal(joinWrapped('linear', 'attention'), 'linear attention');
});

test('hyphenated words are rejoined only for searching', () => {
	assert.equal(joinWrapped('a ma-', 'chine learns', { dehyphenate: true }), 'a machine learns');
	// A capital letter after the hyphen is a compound name, not a broken word.
	assert.equal(joinWrapped('Gated Delta-', 'Net', { dehyphenate: true }), 'Gated Delta-Net');
});

test('text with blank lines between paragraphs keeps its paragraphs', () => {
	assert.equal(cleanText('这是\n中文 。\n\nA state-\nspace model.\nα = 0.5'), '这是中文。\n\nA state-space model. α = 0.5');
	assert.equal(cleanText('atten\u00ad\ntion'), 'attention');
});

test('paragraphs are rebuilt from where the lines sit on the page', () => {
	// What a selection in the PDF text layer gives: one line break per typeset line and
	// no blank lines. Line pitch 18; the second paragraph starts after a larger gap.
	const line = (text, top, right = 500) => ({ text, top, left: 100, right, height: 12 });
	const lines = [
		line('考虑作用于 token 表示序列的普通单头线性注意力。每个 token 通过对输入进行可', 0),
		line('学习的线性投影，生成查询、键和值。在每一步，线性注意力通过秩一更新写入循', 18),
		line('环矩阵状态，再通过矩阵与向量的乘积读取状态。', 36, 330),
		line('状态容量完全由其形状决定。当键和值均为 d 维时，状态最多能够区分 d 个', 61),
		line('相互正交的键。', 79, 180),
	];
	assert.equal(
		joinLines(lines),
		'考虑作用于 token 表示序列的普通单头线性注意力。每个 token 通过对输入进行可学习的线性投影，生成查询、键和值。在每一步，线性注意力通过秩一更新写入循环矩阵状态，再通过矩阵与向量的乘积读取状态。\n\n' +
			'状态容量完全由其形状决定。当键和值均为 d 维时，状态最多能够区分 d 个相互正交的键。',
	);
});

test('a short last line ends a paragraph even without extra spacing', () => {
	const line = (text, top, right = 500) => ({ text, top, left: 100, right, height: 12 });
	const lines = [
		line('The memory state size is a crucial factor in their', 0),
		line('performance.', 18, 180),
		line('Linear attention extends the hidden state of ordinary', 36),
		line('RNNs to a matrix.', 54, 210),
	];
	assert.equal(
		joinLines(lines),
		'The memory state size is a crucial factor in their performance.\n\nLinear attention extends the hidden state of ordinary RNNs to a matrix.',
	);
});

test('a paragraph that continues in the next column or after a subscript stays whole', () => {
	const lines = [
		{ text: 'the state is read with a', top: 700, left: 50, right: 290, height: 10 },
		// Top of the next column.
		{ text: 'query at every step', top: 80, left: 310, right: 550, height: 10 },
		// A subscript that extraction put on its own line.
		{ text: 't', top: 84, left: 552, right: 556, height: 7 },
	];
	assert.equal(joinLines(lines), 'the state is read with a query at every step t');
	assert.equal(joinLines([]), '');
});

test('a full line of a left column is not mistaken for the end of a paragraph', () => {
	const left = (text, top, right = 290) => ({ text, top, left: 50, right, height: 10 });
	const right = (text, top) => ({ text, top, left: 310, right: 550, height: 10 });
	const lines = [
		left('Linear attention writes to the state.', 600),
		left('It reads the state with a query, which', 612),
		left('retrieves the stored value.', 624, 200),
		right('The capacity is set by the shape of', 80),
		right('the state and nothing else at all.', 92),
	];
	assert.equal(
		joinLines(lines),
		'Linear attention writes to the state. It reads the state with a query, which retrieves the stored value.\n\n' +
			'The capacity is set by the shape of the state and nothing else at all.',
	);
});

test('a paragraph that runs over a page break stays whole', () => {
	const lines = [
		{ text: 'the state is written with', top: 700, left: 100, right: 500, height: 10, page: 3 },
		{ text: 'an outer product.', top: 80, left: 100, right: 250, height: 10, page: 4 },
		{ text: 'Reading contracts it with a query.', top: 92, left: 100, right: 400, height: 10, page: 4 },
	];
	assert.equal(joinLines(lines), 'the state is written with an outer product.\n\nReading contracts it with a query.');
});

test('page text for the search index rejoins words broken across lines', () => {
	const items = [
		{ str: 'Can a ma-', hasEOL: true },
		{ str: 'chine really finish', hasEOL: true },
		{ str: '线性', hasEOL: false },
		{ str: '注意力', hasEOL: true },
	];
	assert.equal(searchableText(items), 'Can a machine really finish 线性注意力');
});

// --- positions ----------------------------------------------------------------------

test('a position survives being written to a link and read back', () => {
	assert.equal(formatPosition({ page: 4, y: 0.4237 }), 'page=4&y=0.424');
	assert.equal(formatPosition({ page: 1, y: 0 }), 'page=1');
	assert.deepEqual(parsePosition('#page=4&y=0.424', 19), { page: 4, y: 0.424, legacyTop: null });
	assert.deepEqual(parsePosition(formatPosition({ page: 2, y: 0.5 }), 19), { page: 2, y: 0.5, legacyTop: null });
});

test('positions outside the document or with other actions are refused or stripped', () => {
	assert.equal(parsePosition('page=0', 12), null);
	assert.equal(parsePosition('page=13', 12), null);
	assert.equal(parsePosition('page=2.5', 12), null);
	assert.equal(parsePosition(null, 12), null);
	assert.equal(parsePosition('page=3&' + 'x'.repeat(400), 12), null);
	assert.deepEqual(parsePosition('page=3&nameddest=bad&y=7', 12), { page: 3, y: 1, legacyTop: null });
});

test('positions saved by the earlier reader are still understood', () => {
	assert.deepEqual(parsePosition('page=4&zoom=auto,-127,544', 19), { page: 4, y: null, legacyTop: 544 });
	assert.deepEqual(parsePosition('page=4&zoom=125,0,80.5', 19), { page: 4, y: null, legacyTop: 80.5 });
	assert.deepEqual(parsePosition('page=4&zoom=auto', 19), { page: 4, y: null, legacyTop: null });
});

test('offsets count pages from the start of the document', () => {
	assert.equal(toOffset({ page: 3, y: 0.25 }), 2.25);
	assert.deepEqual(fromOffset(2.25, 10), { page: 3, y: 0.25 });
	assert.equal(fromOffset(-1, 10).page, 1);
	assert.equal(fromOffset(99, 10).page, 10);
});

// --- outlines -----------------------------------------------------------------------

const chapter = (title, page, y, level = 1) => ({ title, page, y, level });

test('the current chapter is the last heading at or above the top of the screen', () => {
	const outline = [chapter('引言', 1, 0.5), chapter('方法', 2, 0.2), chapter('结构', 2, 0.6, 2), chapter('实验', 4, 0.1)];
	assert.equal(currentChapter(outline, { page: 1, y: 0 }), -1);
	assert.equal(currentChapter(outline, { page: 1, y: 0.5 }), 0);
	// A heading just below the top edge already counts.
	assert.equal(currentChapter(outline, { page: 2, y: 0.1 }), 1);
	assert.equal(currentChapter(outline, { page: 2, y: 0.55 }), 2);
	assert.equal(currentChapter(outline, { page: 3, y: 0.9 }), 2);
	assert.equal(currentChapter(outline, { page: 9, y: 0 }), 3);
});

test('in two columns, a later chapter higher on the page does not hide the earlier one', () => {
	// "实验" starts at the top of the right column; "相关工作" is lower, in the left column.
	const outline = [chapter('引言', 1, 0.5), chapter('相关工作', 4, 0.37), chapter('实验', 4, 0.05)];
	assert.equal(currentChapter(outline, { page: 4, y: 0 }), 0);
	assert.equal(currentChapter(outline, { page: 4, y: 0.4 }), 2);
});

test('a place in the translation maps to the same chapter of the original', () => {
	const zh = [chapter('引言', 1, 0.5), chapter('方法', 2, 0.8), chapter('实验', 4, 0.3), chapter('结论', 9, 0.1)];
	const en = [chapter('Intro', 1, 0.55), chapter('Method', 2, 0.4), chapter('Experiments', 5, 0.6), chapter('Conclusion', 8, 0.2)];
	const pairs = alignOutlines(zh, en, 12, 10);
	assert.ok(pairs);

	// The start of a chapter maps to the start of the same chapter.
	assert.equal(mapOffset(pairs, toOffset(zh[2]), 12, 10), toOffset(en[2]));
	// Halfway through a chapter maps to halfway through it.
	const halfway = (toOffset(zh[1]) + toOffset(zh[2])) / 2;
	assert.ok(Math.abs(mapOffset(pairs, halfway, 12, 10) - (toOffset(en[1]) + toOffset(en[2])) / 2) < 1e-9);
	// And back again.
	assert.ok(Math.abs(mapOffset(pairs, mapOffset(pairs, 6.2, 12, 10), 12, 10, true) - 6.2) < 1e-9);
	// Both ends of the documents correspond.
	assert.equal(mapOffset(pairs, 0, 12, 10), 0);
	assert.equal(mapOffset(pairs, 12, 12, 10), 10);
});

test('outlines of different shapes are not matched chapter by chapter', () => {
	const zh = [chapter('引言', 1, 0.5), chapter('方法', 2, 0.8), chapter('实验', 4, 0.3)];
	assert.equal(alignOutlines(zh, zh.slice(0, 2), 12, 10), null);
	assert.equal(alignOutlines(zh, [], 12, 10), null);
	const otherLevels = zh.map((entry) => ({ ...entry, level: 3 }));
	assert.equal(alignOutlines(zh, otherLevels, 12, 10), null);
	// Without matched chapters the overall proportion is used.
	assert.equal(mapOffset(null, 6, 12, 10), 5);
	assert.equal(mapOffset(null, 5, 12, 10, true), 6);
});

// --- search -------------------------------------------------------------------------

const library = () => [
	{ id: 'a', title: 'Alpha', variant: 'zh', pages: ['引言', 'Delta Rule 让状态容量 state capacity 更大。再谈 delta rule。'] },
	{ id: 'a', title: 'Alpha', variant: 'original', pages: ['The delta rule enlarges the state.'] },
	{ id: 'b', title: 'Beta', variant: 'zh', pages: ['delta 和 rule 分开出现，rule 在后面', '无关'] },
];

test('a query is matched as a phrase, ignoring case and extra spaces', () => {
	assert.deepEqual(parseQuery('  Delta   RULE '), { phrase: 'delta rule', terms: ['delta', 'rule'] });
	const found = searchPapers(library(), 'Delta  rule');
	assert.equal(found.mode, 'phrase');
	// Paper b has both words but never the phrase.
	assert.deepEqual(found.papers.map((paper) => paper.id), ['a']);
	assert.equal(found.papers[0].count, 3);
	assert.equal(found.papers[0].pages, 2);
	assert.deepEqual(found.papers[0].hits.map((hit) => [hit.variant, hit.page, hit.count]), [
		['zh', 2, 2],
		['original', 1, 1],
	]);
});

test('the words are matched separately only when the phrase is nowhere', () => {
	const found = searchPapers(library(), 'rule delta');
	assert.equal(found.mode, 'terms');
	assert.deepEqual(found.terms, ['rule', 'delta']);
	assert.deepEqual(found.papers.map((paper) => paper.id).sort(), ['a', 'b']);
	assert.equal(searchPapers(library(), '').papers.length, 0);
	assert.equal(searchPapers(library(), '不存在的词').papers.length, 0);
});

test('excerpts mark every match and keep the original capitals', () => {
	const [hit] = searchPapers(library(), 'delta rule').papers[0].hits;
	assert.deepEqual(
		hit.segments.filter((segment) => segment.match).map((segment) => segment.text),
		['Delta Rule', 'delta rule'],
	);
	assert.equal(hit.segments.map((segment) => segment.text).join(''), 'Delta Rule 让状态容量 state capacity 更大。再谈 delta rule。');
	assert.equal(hit.clippedStart, false);

	const long = [{ id: 'c', title: 'C', variant: 'zh', pages: ['x'.repeat(300) + ' needle ' + 'y'.repeat(300)] }];
	const [clipped] = searchPapers(long, 'needle').papers[0].hits;
	assert.equal(clipped.clippedStart, true);
	assert.equal(clipped.clippedEnd, true);
	assert.ok(clipped.segments.map((segment) => segment.text).join('').length < 200);
});

test('papers that mention the query more come first, and stored hits are capped', () => {
	const docs = [
		{ id: 'few', title: 'Few', variant: 'zh', pages: ['kv cache'] },
		{ id: 'many', title: 'Many', variant: 'zh', pages: Array(20).fill('kv cache and kv cache') },
	];
	const found = searchPapers(docs, 'kv cache', { hitsPerPaper: 5 });
	assert.deepEqual(found.papers.map((paper) => paper.id), ['many', 'few']);
	assert.equal(found.papers[0].hits.length, 5);
	assert.equal(found.papers[0].pages, 20);
	assert.equal(found.pages, 21);
});
