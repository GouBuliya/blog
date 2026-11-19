// The search field of the paper list.
//
// One field does both: it filters the list by title as before, and below the list it
// shows where the text of the papers mentions the query, with the sentence around it.
// A result opens the reader on that page with the words highlighted.

import SearchWorker from './search.worker?worker';

interface Hit {
	variant: 'zh' | 'original';
	page: number;
	count: number;
	segments: { text: string; match: boolean }[];
	clippedStart: boolean;
	clippedEnd: boolean;
}

interface Result {
	mode: 'phrase' | 'terms';
	pages: number;
	papers: { id: string; title: string; count: number; pages: number; hits: Hit[] }[];
}

/** Excerpts shown for a paper before "show more" is used. */
const VISIBLE_HITS = 3;

const root = document.querySelector<HTMLElement>('#paper-search-root')!;
const input = document.querySelector<HTMLInputElement>('#paper-search')!;
const originals = document.querySelector<HTMLInputElement>('#search-originals')!;
const items = [...document.querySelectorAll<HTMLLIElement>('.paper-list li')];
const list = document.querySelector<HTMLElement>('.paper-list')!;
const noTitles = document.querySelector<HTMLElement>('#paper-empty')!;
const section = document.querySelector<HTMLElement>('#fulltext')!;
const heading = document.querySelector<HTMLElement>('#fulltext-heading')!;
const status = document.querySelector<HTMLElement>('#fulltext-status')!;
const results = document.querySelector<HTMLElement>('#fulltext-results')!;

const { readerBase, indexZh, indexOriginal } = root.dataset as Record<string, string>;

let worker: Worker | undefined;
let requestId = 0;
let timer = 0;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
	const node = document.createElement(tag);
	if (className) node.className = className;
	if (text !== undefined) node.textContent = text;
	return node;
}

function hitLink(paperId: string, hit: Hit, query: string, mode: Result['mode']) {
	const params = new URLSearchParams();
	if (hit.variant === 'original') params.set('file', 'original');
	params.set('q', query);
	if (mode === 'terms') params.set('match', 'words');
	return `${readerBase}${encodeURIComponent(paperId)}/read/?${params}#page=${hit.page}`;
}

function renderHit(paperId: string, hit: Hit, query: string, mode: Result['mode']) {
	const link = element('a', 'hit');
	link.href = hitLink(paperId, hit, query, mode);

	const where = element('span', 'hit-page', `第 ${hit.page} 页`);
	if (hit.variant === 'original') where.append(element('span', 'hit-tag', '原文'));
	link.append(where);

	const excerpt = element('span', 'hit-text');
	if (hit.clippedStart) excerpt.append('…');
	for (const segment of hit.segments) {
		excerpt.append(segment.match ? element('mark', undefined, segment.text) : segment.text);
	}
	if (hit.clippedEnd) excerpt.append('…');
	link.append(excerpt);
	return link;
}

function render(result: Result, query: string) {
	results.replaceChildren();
	if (!result.papers.length) {
		status.textContent = originals.checked ? '正文里没有找到。' : '译文正文里没有找到。可以勾选“同时搜索英文原文”再试。';
		return;
	}

	status.textContent =
		`${result.papers.length} 篇论文，共 ${result.pages} 页` +
		(result.mode === 'terms' ? '。没有找到完整的词组，下面是同时出现这些词的页面。' : '');

	for (const paper of result.papers) {
		const group = element('li', 'hit-group');
		const title = element('a', 'hit-title', paper.title);
		title.href = hitLink(paper.id, paper.hits[0], query, result.mode);
		const count = element('span', 'hit-count', `${paper.count} 处`);
		const head = element('div', 'hit-head');
		head.append(title, count);
		group.append(head);

		const hits = paper.hits.map((hit) => renderHit(paper.id, hit, query, result.mode));
		group.append(...hits.slice(0, VISIBLE_HITS));

		const rest = hits.slice(VISIBLE_HITS);
		if (rest.length) {
			const more = element('button', 'hit-more');
			more.type = 'button';
			// Only the first few pages are kept for each paper; the reader's own search shows all.
			const unlisted = paper.pages - hits.length;
			more.textContent = `再显示 ${rest.length} 页` + (unlisted > 0 ? `（另有 ${unlisted} 页，可进入论文后查找）` : '');
			more.addEventListener('click', () => more.replaceWith(...rest));
			group.append(more);
		}
		results.append(group);
	}
}

function filterTitles(query: string) {
	const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
	let shown = 0;
	for (const item of items) {
		item.hidden = !terms.every((term) => item.dataset.search!.includes(term));
		if (!item.hidden) shown++;
	}
	list.hidden = shown === 0;
	return shown;
}

function searchText(query: string) {
	worker ??= (() => {
		const created = new SearchWorker();
		created.onmessage = ({ data }) => {
			if (data.id !== requestId) return;
			if (data.failed) {
				results.replaceChildren();
				status.textContent = '正文索引加载失败，请检查网络后重试。';
			} else {
				render(data.result, input.value.trim());
			}
		};
		return created;
	})();
	worker.postMessage({ id: requestId, query, originals: originals.checked, urls: { zh: indexZh, original: indexOriginal } });
}

function apply() {
	window.clearTimeout(timer);
	requestId++;
	const query = input.value.trim();

	// The query lives in the address so that it survives opening a paper and coming back.
	const url = new URL(location.href);
	url.search = '';
	if (query) url.searchParams.set('q', query);
	if (originals.checked) url.searchParams.set('originals', '1');
	history.replaceState(history.state, '', url);

	const shown = filterTitles(query);

	// One letter or one Chinese character matches nearly every page.
	const searchable = query.length >= 2;
	section.hidden = !searchable;
	noTitles.hidden = shown > 0 || searchable;
	if (!searchable) return;

	heading.textContent = shown ? '正文中提到' : `标题里没有“${query}”，正文中提到`;
	if (!results.childElementCount) status.textContent = '正在搜索正文…';
	// The first search downloads the text of all papers; wait until typing pauses.
	timer = window.setTimeout(() => searchText(query), worker ? 120 : 350);
}

const params = new URLSearchParams(location.search);
input.value = params.get('q') ?? '';
originals.checked = params.has('originals');

input.addEventListener('input', apply);
originals.addEventListener('change', apply);
apply();
