// The reader page: one or two panes showing a paper, and the tools around them.
//
// Each tool lives in its own module. This file creates the panes, decides which file
// each one shows, and connects the toolbar to the pane the reader is using.

import 'pdfjs-dist/legacy/web/pdf_viewer.css';
import { alignOutlines, mapOffset } from '../../utils/reader/outline.mjs';
import { formatPosition, fromOffset, toOffset } from '../../utils/reader/position.mjs';
import { type Chapter, type Version, readConfig } from './config';
import { cleanCopies } from './copy';
import { FindBar } from './find-bar';
import { OutlineList } from './outline-list';
import { Pane, type Position } from './pane';
import { RegionZoom } from './region-zoom';
import { $, Sheet, copyText, narrow, toast } from './ui';

const config = readConfig();
const root = $('reader');

function stored(key: string) {
	try {
		return localStorage.getItem(`paper-reader:${key}`);
	} catch {
		// Storage can be unavailable, for example in private browsing.
		return null;
	}
}

function store(key: string, value: string) {
	try {
		localStorage.setItem(`paper-reader:${key}`, value);
	} catch {
		// The setting then lasts until the page is closed.
	}
}

// --- Panes --------------------------------------------------------------------------

interface Slot {
	pane: Pane;
	host: HTMLElement;
	/** The file the pane shows. */
	version: Version;
}

let fitPreference: 'text' | 'width' = stored('fit') === 'width' ? 'width' : 'text';

function createSlot(name: 'primary' | 'side', version: Version): Slot {
	const slot: Slot = {
		host: $(`${name}-pane`),
		version,
		pane: new Pane({
			container: $<HTMLDivElement>(`${name}-viewer`),
			assetsUrl: config.assetsUrl,
			// On a phone the toolbar lies over the top of the pages.
			topInset: () => (name === 'primary' && narrow.matches ? $('top-bar').offsetHeight : 0),
			onChange: () => paneChanged(slot),
			onFind: (status) => slot === active && findBar.report(status),
		}),
	};
	slot.pane.setFit(fitPreference);
	// The toolbar works on the pane the reader touched last.
	for (const type of ['pointerdown', 'wheel', 'touchstart', 'focusin', 'keydown']) {
		slot.pane.container.addEventListener(type, () => setActive(slot), { passive: true });
	}
	return slot;
}

const primary = createSlot('primary', config.main);
let side: Slot | null = null;
let active = primary;

/** What the side pane shows: the other language, or another place in the same file. */
let sideMode: 'off' | 'other' | 'same' = 'off';
let syncScroll = true;

const otherVersion = (version: Version) => (config.original ? (version === config.main ? config.original : config.main) : null);

/** Matching chapters of the translation and the original, to move between the two. */
const chapterPairs = config.original
	? alignOutlines(config.main.outline, config.original.outline, config.main.pages, config.original.pages)
	: null;

/** The place in `to` that corresponds to a place in `from`. */
function mapPosition(from: Version, to: Version, position: Position): Position {
	if (from === to || !config.original) return position;
	const offset = mapOffset(chapterPairs, toOffset(position), config.main.pages, config.original.pages, from === config.original);
	return fromOffset(offset, to.pages);
}

async function open(slot: Slot, version: Version, start: Position | string | null, keySuffix = '') {
	slot.version = version;
	const status = slot.host.querySelector<HTMLElement>('.load-status')!;
	const message = status.querySelector<HTMLElement>('.load-message')!;
	status.querySelector<HTMLAnchorElement>('a')!.href = version.url;
	message.textContent = '正在加载…';
	status.hidden = false;

	try {
		const opened = await slot.pane.open(version.url, `paper-reader:${version.storageKey}${keySuffix}`, start, (loaded) => {
			message.textContent = `正在加载… ${Math.round(loaded * 100)}%`;
		});
		if (!opened) return false;
	} catch (error) {
		console.error(error);
		message.textContent = '加载失败。';
		return false;
	}
	status.hidden = true;
	if (slot === active) {
		showActiveVersion();
		findBar.search();
	}
	return true;
}

function setActive(slot: Slot) {
	if (slot === active) return;
	const previous = active;
	active = slot;
	previous.host.classList.remove('active');
	slot.host.classList.add('active');
	if (findBar.isOpen) {
		previous.pane.find('');
		findBar.search();
	}
	if (regionZoom.isSelecting) regionZoom.cancel();
	showActiveVersion();
}

function paneChanged(slot: Slot) {
	if (slot === active) refreshToolbar();
	// The pane being scrolled leads; the other one follows to the matching place.
	if (slot !== active || sideMode !== 'other' || !syncScroll || !side) return;
	const follower = slot === primary ? side : primary;
	if (!slot.pane.isReady || !follower.pane.isReady) return;
	follower.pane.scrollTo(mapPosition(slot.version, follower.version, slot.pane.position()));
}

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

function resizePanes() {
	primary.pane.resize();
	if (sideMode !== 'off') side?.pane.resize();
}

// --- Translation and original -------------------------------------------------------

async function openSide(mode: 'other' | 'same') {
	side ??= createSlot('side', primary.version);
	sideMode = mode;
	$('side-pane').hidden = false;
	root.classList.add('split');
	updateCompareControls();
	await nextFrame();
	primary.pane.resize();

	const version = mode === 'other' ? otherVersion(primary.version)! : primary.version;
	const start = mapPosition(primary.version, version, primary.pane.position());
	// A second view of the same file keeps its own position.
	await open(side, version, start, mode === 'same' ? ':side' : '');
}

async function closeSide() {
	if (!side || sideMode === 'off') return;
	if (active === side) setActive(primary);
	sideMode = 'off';
	$('side-pane').hidden = true;
	root.classList.remove('split');
	updateCompareControls();
	await side.pane.close();
	await nextFrame();
	primary.pane.resize();
}

/** Shows the other language in the main pane, at the place that is being read. */
async function switchVersion() {
	const to = otherVersion(primary.version);
	if (!to) return;
	await closeSide();
	const start = mapPosition(primary.version, to, primary.pane.position());
	if (await open(primary, to, start)) {
		updateUrl();
		updateCompareControls();
	}
}

function updateCompareControls() {
	const other = otherVersion(primary.version);
	const toggle = $('compare-toggle');
	// A phone has room for one pane, so the button switches languages there.
	$('compare-label').textContent = narrow.matches ? (other?.label ?? '') : other ? '对照' : '分屏';
	toggle.title = narrow.matches ? `切换到${other?.label ?? ''}` : other ? `并排显示${other.label}` : '并排显示本文的另一处';
	toggle.hidden = narrow.matches && !other;
	toggle.setAttribute('aria-pressed', String(sideMode !== 'off'));

	// Without an original there is nothing to choose: the side pane shows the same file.
	$('side-choice').hidden = !other;
	$('side-label').hidden = !!other;
	$('side-other').textContent = other?.label ?? '';
	$('side-other').setAttribute('aria-pressed', String(sideMode === 'other'));
	$('side-same').setAttribute('aria-pressed', String(sideMode === 'same'));
	$('sync-toggle').hidden = sideMode !== 'other';
	$('sync-toggle').setAttribute('aria-pressed', String(syncScroll));

	const switcher = $('switch-version');
	switcher.hidden = !other;
	switcher.textContent = `切换到${other?.label ?? ''}`;
}

$('compare-toggle').addEventListener('click', () => {
	if (narrow.matches) void switchVersion();
	else if (sideMode === 'off') void openSide(config.original ? 'other' : 'same');
	else void closeSide();
});
$('side-other').addEventListener('click', () => sideMode !== 'other' && void openSide('other'));
$('side-same').addEventListener('click', () => sideMode !== 'same' && void openSide('same'));
$('side-close').addEventListener('click', () => void closeSide());
$('sync-toggle').addEventListener('click', () => {
	syncScroll = !syncScroll;
	updateCompareControls();
	if (syncScroll) paneChanged(active);
});

// --- Toolbar ------------------------------------------------------------------------

const pageInput = $<HTMLInputElement>('page-number');

function refreshToolbar() {
	const { pane } = active;
	const ready = pane.isReady;
	for (const id of ['page-number', 'zoom-out', 'zoom-in', 'zoom-reset', 'find-toggle', 'region-toggle']) {
		$<HTMLButtonElement>(id).disabled = !ready;
	}
	if (!ready) return;

	const position = pane.position();
	if (document.activeElement !== pageInput) pageInput.value = String(position.page);
	pageInput.max = String(pane.pages);
	$('page-count').textContent = `/ ${pane.pages}`;
	$('zoom-reset').textContent = `${Math.round(pane.scale * 100)}%`;
	outline.update(position);

	const origin = pane.jumpOrigin;
	$('back-chip').hidden = !origin;
	if (origin) $('back-button').textContent = `回到第 ${origin.page} 页`;

	const fit = pane.currentFit;
	$('fit-text').setAttribute('aria-pressed', String(fit === 'text'));
	$('fit-width').setAttribute('aria-pressed', String(fit === 'width'));
}

/** Updates what depends on the file in the active pane. */
function showActiveVersion() {
	const { version } = active;
	outline.setChapters(version.outline);
	$('outline-version').textContent = config.original ? version.label : '';
	$<HTMLAnchorElement>('download-link').href = version.url;
	$('download-link').textContent = config.original ? `下载${version.label} PDF` : '下载 PDF';
	$('fit-text').hidden = !active.pane.canFitText;
	refreshToolbar();
}

pageInput.addEventListener('focus', () => pageInput.select());
pageInput.addEventListener('change', () => {
	const page = Math.round(Number(pageInput.value));
	if (page >= 1 && page <= active.pane.pages) active.pane.jumpTo({ page, y: 0 });
	// Hands the keyboard back to scrolling, and closes the on-screen keyboard.
	active.pane.container.focus({ preventScroll: true });
	refreshToolbar();
});

$('zoom-in').addEventListener('click', () => active.pane.zoomBy(1.15));
$('zoom-out').addEventListener('click', () => active.pane.zoomBy(1 / 1.15));
$('zoom-reset').addEventListener('click', () => setFit(fitPreference));

function setFit(fit: 'text' | 'width') {
	fitPreference = fit;
	store('fit', fit);
	primary.pane.setFit(fit);
	side?.pane.setFit(fit);
	refreshToolbar();
}

$('back-button').addEventListener('click', () => active.pane.goBack());
$('back-dismiss').addEventListener('click', () => active.pane.dismissJump());

// --- Chapters -----------------------------------------------------------------------

const outline = new OutlineList($('outline-list'), (chapter: Chapter) => {
	// A little room above the heading, so that it does not sit against the edge.
	active.pane.jumpTo({ page: chapter.page, y: Math.max(0, chapter.y - 0.02) });
	// On a phone the list covers the page; beside the pages it stays open.
	if (narrow.matches) outlineSheet.close(false);
});

const outlineSheet = new Sheet($('outline-panel'), {
	docked: true,
	onToggle(open) {
		root.classList.toggle('outline-open', open);
		if (open) outline.reveal();
		requestAnimationFrame(resizePanes);
	},
});
$('outline-toggle').addEventListener('click', (event) => outlineSheet.toggle(event.currentTarget as HTMLElement));

// --- Finding text -------------------------------------------------------------------

let findOrigin: { slot: Slot; position: Position } | null = null;

const findBar = new FindBar(
	() => active.pane,
	$('find-toggle'),
	() => {
		// Searching moves through the paper; offer the way back to where it started.
		if (findOrigin?.slot.pane.isReady) findOrigin.slot.pane.remember(findOrigin.position);
		findOrigin = null;
		root.classList.remove('finding');
	},
);

function openFind(query?: string, separateWords = false) {
	if (!active.pane.isReady) return;
	if (!findBar.isOpen) findOrigin = { slot: active, position: active.pane.position() };
	root.classList.add('finding');
	showBars();
	findBar.open(query, separateWords);
}

$('find-toggle').addEventListener('click', () => (findBar.isOpen ? findBar.close() : openFind()));

// --- Enlarging a region -------------------------------------------------------------

const regionZoom = new RegionZoom();
$('region-toggle').addEventListener('click', (event) => {
	showBars();
	regionZoom.toggle(active.pane, event.currentTarget as HTMLElement);
});

// --- Menu ---------------------------------------------------------------------------

const menu = new Sheet($('menu-panel'));
$('menu-toggle').addEventListener('click', (event) => menu.toggle(event.currentTarget as HTMLElement));
$('sheet-backdrop').addEventListener('click', () => Sheet.closeModal());
// Every menu entry acts at once, so the menu closes behind it.
$('menu-panel').addEventListener('click', (event) => {
	if ((event.target as HTMLElement).closest('[data-keep-open]')) return;
	if ((event.target as HTMLElement).closest('button, a')) menu.close(false);
});

$('copy-link').addEventListener('click', async () => {
	if (!active.pane.isReady) return;
	const position = active.pane.position();
	const url = new URL(location.pathname, location.href);
	if (active.version === config.original) url.searchParams.set('file', 'original');
	url.hash = formatPosition(position);

	if (await copyText(url.href)) {
		toast(`已复制第 ${position.page} 页的链接`);
		return;
	}
	// The browser refused; show the link so that it can be copied by hand.
	const field = $<HTMLInputElement>('link-field');
	field.value = url.href;
	$<HTMLDialogElement>('link-dialog').showModal();
	field.select();
});

$('fit-text').addEventListener('click', () => setFit('text'));
$('fit-width').addEventListener('click', () => setFit('width'));
$('switch-version').addEventListener('click', () => void switchVersion());

let cleanCopy = stored('clean-copy') !== 'off';
const cleanCopyToggle = $('clean-copy-toggle');
cleanCopyToggle.setAttribute('aria-pressed', String(cleanCopy));
cleanCopyToggle.addEventListener('click', () => {
	cleanCopy = !cleanCopy;
	store('clean-copy', cleanCopy ? 'on' : 'off');
	cleanCopyToggle.setAttribute('aria-pressed', String(cleanCopy));
});
cleanCopies(
	$('panes'),
	() => cleanCopy,
	() => toast('已复制，断行已合并成段落'),
);

// --- Notice about the file ----------------------------------------------------------

if (config.notice) {
	const key = `notice:${config.main.storageKey}`;
	$('notice').hidden = stored(key) === 'dismissed';
	$('notice-dismiss').addEventListener('click', () => {
		$('notice').hidden = true;
		store(key, 'dismissed');
	});
	$('notice-open').addEventListener('click', () => {
		$('notice').hidden = false;
	});
}

// --- Toolbars on a phone ------------------------------------------------------------
//
// The bars lie over the page and move out of the way while reading: scrolling down
// hides them, scrolling up or a tap on the page brings them back.

const showBars = () => root.classList.remove('bars-hidden');

{
	const { container } = primary.pane;
	let lastTop = 0;
	// Time of the reader's last touch or wheel movement. None yet.
	let lastInput = -Infinity;
	const touched = () => {
		lastInput = performance.now();
	};
	container.addEventListener('touchstart', touched, { passive: true });
	container.addEventListener('touchmove', touched, { passive: true });
	container.addEventListener('wheel', touched, { passive: true });

	container.addEventListener(
		'scroll',
		() => {
			const top = container.scrollTop;
			const delta = top - lastTop;
			if (Math.abs(delta) < 8) return;
			lastTop = top;
			// Only the reader's own scrolling counts, not a jump made by a button.
			if (!narrow.matches || performance.now() - lastInput > 2500) return;
			if (findBar.isOpen || regionZoom.isSelecting) return;
			root.classList.toggle('bars-hidden', delta > 0 && top > 80);
		},
		{ passive: true },
	);

	container.addEventListener('click', (event) => {
		if (!root.classList.contains('bars-hidden')) return;
		if ((event.target as HTMLElement).closest('a') || !document.getSelection()?.isCollapsed) return;
		showBars();
	});
}

// --- Keyboard, window and address ---------------------------------------------------

document.addEventListener('keydown', (event) => {
	if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'f') {
		event.preventDefault();
		openFind();
	} else if (event.key === 'Escape') {
		// Dialogs close themselves. Otherwise the innermost thing that is open closes.
		if (document.querySelector('dialog[open]')) return;
		if (regionZoom.isSelecting) regionZoom.cancel();
		else if (Sheet.closeModal()) return;
		else if (findBar.isOpen) findBar.close();
		else if (outlineSheet.isOpen) outlineSheet.close();
	} else if (event.altKey && event.key === 'ArrowLeft' && active.pane.jumpOrigin) {
		event.preventDefault();
		active.pane.goBack();
	}
});

window.addEventListener('resize', resizePanes);
narrow.addEventListener('change', () => {
	// Two panes and a docked chapter list do not fit a phone.
	if (narrow.matches) void closeSide();
	outlineSheet.close(false);
	Sheet.closeModal();
	showBars();
	updateCompareControls();
	requestAnimationFrame(resizePanes);
});

const saveAll = () => {
	primary.pane.save();
	if (sideMode !== 'off') side?.pane.save();
};
// Phones often discard a background tab without any further event.
window.addEventListener('pagehide', saveAll);
document.addEventListener('visibilitychange', () => document.hidden && saveAll());

/** The address names the file being read. Positions are kept out of it after use. */
function updateUrl() {
	const search = primary.version === config.original ? '?file=original' : '';
	history.replaceState(history.state, '', location.pathname + search);
}

window.addEventListener('hashchange', async () => {
	const position = await primary.pane.resolvePosition(location.hash);
	if (!position) return;
	primary.pane.jumpTo(position);
	updateUrl();
});

// --- Start --------------------------------------------------------------------------

{
	const params = new URLSearchParams(location.search);
	const version = params.get('file') === 'original' && config.original ? config.original : config.main;
	const query = params.get('q')?.trim();

	primary.host.classList.add('active');
	primary.version = version;
	showActiveVersion();
	updateCompareControls();

	// A position in the link wins once; after that, reloading returns to where reading stopped.
	void open(primary, version, location.hash.length > 1 ? location.hash : null).then((opened) => {
		updateUrl();
		updateCompareControls();
		if (opened && query) openFind(query, params.get('match') === 'words');
	});
}
