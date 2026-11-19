// One PDF on screen.
//
// Wraps the PDF.js viewer and offers what the reader's features need: the reading
// position, fitting the text column to the screen, jumps that can be undone, finding
// text, and the size of the page being read. It owns no buttons; whoever creates a pane
// listens to it through `onChange` and the other callbacks.

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
	EventBus,
	FindState,
	LinkTarget,
	PDFFindController,
	PDFLinkService,
	PDFViewer,
} from 'pdfjs-dist/legacy/web/pdf_viewer.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { formatPosition, parsePosition } from '../../utils/reader/position.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export { pdfjsLib };

export interface Position {
	page: number;
	y: number;
}

/** How the page is fitted to the pane. A number is a fixed scale chosen by the reader. */
export type Fit = 'text' | 'width' | number;

export interface FindStatus {
	current: number;
	total: number;
	pending: boolean;
	notFound: boolean;
}

interface PaneOptions {
	/** Scroll container. PDF.js requires it to be absolutely positioned. */
	container: HTMLDivElement;
	/** Where the PDF.js character maps, fonts and decoders are served from. */
	assetsUrl: string;
	/** Height at the top of the container that is covered by a toolbar, in CSS pixels. */
	topInset(): number;
	/** Called when the page, the scale or the jump history changes. */
	onChange(): void;
	/** Called when a search in the document progresses. */
	onFind(status: FindStatus): void;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 5;
const CSS_UNITS = pdfjsLib.PixelsPerInch.PDF_TO_CSS_UNITS;
/** Space kept on each side of the text column, in CSS pixels. */
const TEXT_GUTTER = 12;
/** Largest scales chosen automatically. A 10pt body is then about 19 and 17 CSS pixels tall. */
const MAX_FIT_TEXT = 1.4;
const MAX_FIT_WIDTH = 1.25;
/** Jumps shorter than this, in pages, are not worth a way back. */
const MIN_JUMP = 0.5;

/**
 * The horizontal extent of the text on the pages, in PDF units from the left page edge.
 *
 * Papers have wide margins; knowing where the text column is lets the reader fill the
 * screen with text, which on a phone makes the letters half as large again.
 */
async function measureTextColumn(doc: any): Promise<{ left: number; right: number; width: number } | null> {
	const lefts: number[] = [];
	const rights: number[] = [];
	let pageWidth = 0;

	// The first page often has a wider title block, so a few pages are sampled.
	const sample = [2, 3, 4, 5, 1].filter((number) => number <= doc.numPages).slice(0, 4);
	for (const number of sample) {
		const page = await doc.getPage(number);
		if (page.rotate % 180 !== 0) return null;
		const [x0, , x1] = page.view;
		pageWidth ||= x1 - x0;
		const { items } = await page.getTextContent();
		for (const item of items) {
			const upright = Math.abs(item.transform[1]) < 0.01 && Math.abs(item.transform[2]) < 0.01;
			if (!upright || item.str.trim().length < 2) continue;
			lefts.push(item.transform[4] - x0);
			rights.push(item.transform[4] - x0 + item.width);
		}
	}
	if (lefts.length < 40) return null;

	// Stray marks in the margin, like the arXiv stamp or line numbers, are left out.
	lefts.sort((a, b) => a - b);
	rights.sort((a, b) => a - b);
	const left = lefts[Math.floor(lefts.length * 0.01)];
	const right = rights[Math.ceil(rights.length * 0.99) - 1];
	if (!(right - left > pageWidth * 0.4)) return null;
	return { left: Math.max(0, left), right: Math.min(pageWidth, right), width: pageWidth };
}

export class Pane {
	readonly container: HTMLDivElement;
	/** Number of pages, or 0 while nothing is open. */
	pages = 0;

	private readonly options: PaneOptions;
	private readonly bus = new EventBus();
	private readonly link: PDFLinkService;
	private readonly finder: PDFFindController;
	private readonly viewer: PDFViewer;

	private doc: any = null;
	private task: any = null;
	private generation = 0;
	private ready = false;

	private fit: Fit = 'text';
	private column: { left: number; right: number; width: number } | null = null;

	private storageKey = '';
	private saveTimer = 0;
	private trail: Position[] = [];
	private findQuery: string | string[] = '';

	constructor(options: PaneOptions) {
		this.options = options;
		this.container = options.container;

		this.link = new PDFLinkService({
			eventBus: this.bus,
			externalLinkTarget: LinkTarget.BLANK,
			externalLinkRel: 'noopener noreferrer',
		});
		this.finder = new PDFFindController({ eventBus: this.bus, linkService: this.link });
		this.viewer = new PDFViewer({
			container: this.container,
			eventBus: this.bus,
			linkService: this.link,
			findController: this.finder,
			// Without page borders a page can use the full width of a phone screen.
			removePageBorders: true,
		});
		this.link.setViewer(this.viewer);

		// Links inside the PDF (a citation, "Eq. 3", a figure) jump away from where the
		// reader was. The place is remembered so that there is a way back.
		const goToDestination = this.link.goToDestination.bind(this.link);
		this.link.goToDestination = async (dest: unknown) => {
			const from = this.position();
			await goToDestination(dest);
			this.remember(from);
		};

		this.bus.on('updateviewarea', () => {
			if (!this.ready) return;
			window.clearTimeout(this.saveTimer);
			this.saveTimer = window.setTimeout(() => this.save(), 400);
			this.options.onChange();
		});
		this.bus.on('scalechanging', () => this.ready && this.options.onChange());
		this.bus.on('updatefindcontrolstate', (event: any) => this.reportFind(event.state, event.matchesCount));
		this.bus.on('updatefindmatchescount', (event: any) => this.reportFind(null, event.matchesCount));

		this.enableZoomGestures();
	}

	// --- Opening -------------------------------------------------------------------

	/**
	 * Opens a PDF.
	 *
	 * @param storageKey Where the reading position of this file is kept.
	 * @param start Where to open it: a place, or a position as written in a link.
	 *   Without one, or when the link does not fit this file, the last reading position is used.
	 * @param onProgress Called with the share of the file that has arrived, 0 to 1.
	 * @returns false when another file was opened before this one finished loading.
	 */
	async open(url: string, storageKey: string, start: Position | string | null, onProgress: (loaded: number) => void) {
		this.save();
		const generation = ++this.generation;
		this.ready = false;
		this.trail = [];
		this.findQuery = '';
		this.column = null;
		this.storageKey = storageKey;

		const previous = this.task;
		this.viewer.setDocument(null as any);
		this.link.setDocument(null);
		this.doc = null;
		this.pages = 0;
		if (previous) await previous.destroy();
		if (generation !== this.generation) return false;

		const assets = this.options.assetsUrl;
		const task = pdfjsLib.getDocument({
			url,
			cMapUrl: `${assets}cmaps/`,
			cMapPacked: true,
			standardFontDataUrl: `${assets}standard_fonts/`,
			wasmUrl: `${assets}wasm/`,
			iccUrl: `${assets}iccs/`,
		});
		this.task = task;
		task.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
			if (generation === this.generation && total > 0) onProgress(Math.min(1, loaded / total));
		};

		let doc;
		try {
			doc = await task.promise;
		} catch (error) {
			// A failure of a file that is no longer wanted is not worth reporting.
			if (generation !== this.generation) return false;
			throw error;
		}
		if (generation !== this.generation) {
			await task.destroy();
			return false;
		}

		const initialized = new Promise<void>((resolve) => this.bus.on('pagesinit', () => resolve(), { once: true }));
		this.doc = doc;
		this.pages = doc.numPages;
		this.link.setDocument(doc, null);
		this.viewer.setDocument(doc);
		const [column] = await Promise.all([measureTextColumn(doc).catch(() => null), initialized]);
		if (generation !== this.generation) return false;

		this.column = column;
		this.ready = true;
		this.applyFit();
		const position =
			(typeof start === 'string' ? await this.resolvePosition(start) : start) ?? (await this.storedPosition());
		if (generation !== this.generation) return false;
		if (position) this.scrollTo(position);
		this.options.onChange();
		return true;
	}

	get isReady() {
		return this.ready;
	}

	/** Saves the position and releases the document, when the pane is put away. */
	async close() {
		this.save();
		++this.generation;
		this.ready = false;
		this.trail = [];
		this.viewer.setDocument(null as any);
		this.link.setDocument(null);
		const task = this.task;
		this.task = this.doc = null;
		this.pages = 0;
		await task?.destroy();
	}

	/** A proxy for one page, for rendering it outside the viewer. */
	getPage(number: number) {
		return this.doc.getPage(number);
	}

	/** The page elements that are currently laid out, with their page numbers. */
	pageElements(): { number: number; element: HTMLElement }[] {
		return [...this.container.querySelectorAll<HTMLElement>('.page')].map((element) => ({
			number: Number(element.dataset.pageNumber),
			element,
		}));
	}

	// --- Position ------------------------------------------------------------------

	/** The page at the top of the screen and how far down it the screen starts. */
	position(): Position {
		if (!this.ready) return { page: 1, y: 0 };
		const edge = this.container.getBoundingClientRect().top + this.options.topInset();
		// The page being read is the first one that reaches below the top edge. PDF.js
		// reports the most visible page, so it is that one or the one before it.
		let page = this.viewer.currentPageNumber;
		for (let number = Math.max(1, page - 1); number <= this.pages; number++) {
			const rect = this.viewer.getPageView(number - 1).div.getBoundingClientRect();
			if (rect.bottom > edge + 1) {
				page = number;
				break;
			}
		}
		const rect = this.viewer.getPageView(page - 1).div.getBoundingClientRect();
		return { page, y: Math.min(1, Math.max(0, (edge - rect.top) / rect.height)) };
	}

	/** Scrolls so that the given place is at the top of the screen. */
	scrollTo({ page, y }: Position) {
		if (!this.ready) return;
		const rect = this.viewer.getPageView(Math.min(this.pages, Math.max(1, page)) - 1).div.getBoundingClientRect();
		const edge = this.container.getBoundingClientRect().top + this.options.topInset();
		this.container.scrollTop += rect.top - edge + y * rect.height;
		this.viewer.update();
	}

	/** Goes to a place the reader asked for, keeping a way back to where they were. */
	jumpTo(position: Position) {
		if (!this.ready) return;
		const from = this.position();
		this.scrollTo(position);
		this.remember(from);
	}

	/** The place the last jump started from, or null when there is none to return to. */
	get jumpOrigin(): Position | null {
		return this.trail[this.trail.length - 1] ?? null;
	}

	/** Returns to where the last jump started. */
	goBack() {
		const origin = this.trail.pop();
		if (origin) this.scrollTo(origin);
		this.options.onChange();
	}

	/** Forgets the way back, once the reader has dismissed it. */
	dismissJump() {
		this.trail = [];
		this.options.onChange();
	}

	/** Keeps `from` as a place to return to, when the reader is now somewhere else. */
	remember(from: Position) {
		const to = this.position();
		if (Math.abs(to.page + to.y - (from.page + from.y)) < MIN_JUMP) return;
		this.trail.push(from);
		if (this.trail.length > 30) this.trail.shift();
		this.options.onChange();
	}

	/** Reads the saved position of the open file, converting the earlier format. */
	private async storedPosition(): Promise<Position | null> {
		let stored: string | null = null;
		try {
			stored = localStorage.getItem(this.storageKey);
		} catch {
			// Storage can be unavailable, for example in private browsing.
		}
		return this.resolvePosition(stored);
	}

	/** Turns a position written in a link or in storage into a place in this document. */
	async resolvePosition(value: string | null): Promise<Position | null> {
		const parsed = parsePosition(value, this.pages);
		if (!parsed) return null;
		if (parsed.y !== null) return { page: parsed.page, y: parsed.y };
		if (parsed.legacyTop === null) return { page: parsed.page, y: 0 };
		// The earlier format stored the distance from the bottom of the page in PDF units.
		const page = await this.doc.getPage(parsed.page);
		const [, bottom, , top] = page.view;
		return { page: parsed.page, y: Math.min(1, Math.max(0, 1 - (parsed.legacyTop - bottom) / (top - bottom))) };
	}

	save() {
		window.clearTimeout(this.saveTimer);
		if (!this.ready) return;
		try {
			localStorage.setItem(this.storageKey, formatPosition(this.position()));
		} catch {
			// Reading still works without a saved position.
		}
	}

	// --- Scale ---------------------------------------------------------------------

	get scale() {
		return this.viewer.currentScale;
	}

	get currentFit(): Fit {
		return this.fit;
	}

	/** Whether the text column is known, so that fitting it differs from fitting the page. */
	get canFitText() {
		return this.column !== null;
	}

	setFit(fit: Fit) {
		this.fit = fit;
		this.applyFit();
	}

	zoomBy(factor: number, origin?: [number, number]) {
		if (!this.ready) return;
		const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, this.scale * factor));
		this.fit = next;
		this.viewer.updateScale({ scaleFactor: next / this.scale, origin, drawingDelay: origin ? 150 : -1 });
	}

	/** Fits the page again after the pane changed size, for example when a phone is rotated. */
	resize() {
		if (!this.ready || !this.container.clientWidth) return;
		if (typeof this.fit !== 'number') this.applyFit();
		this.viewer.update();
	}

	private applyFit() {
		if (!this.ready || !this.container.clientWidth) return;
		const position = this.position();
		const available = this.container.clientWidth;
		const view = this.viewer.getPageView(position.page - 1);
		const pageWidth = view.viewport.width / view.viewport.scale;

		let scale: number;
		if (typeof this.fit === 'number') {
			scale = this.fit;
		} else if (this.fit === 'text' && this.column) {
			scale = (available - 2 * TEXT_GUTTER) / ((this.column.right - this.column.left) * CSS_UNITS);
			// On a wide screen the text would become larger than is comfortable to read.
			scale = Math.min(scale, MAX_FIT_TEXT);
		} else {
			scale = Math.min(available / (pageWidth * CSS_UNITS), MAX_FIT_WIDTH);
		}
		scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

		if (Math.abs(scale - this.scale) > 0.001) this.viewer.currentScale = scale;
		this.scrollTo(position);
		this.centreOnText();
	}

	/** When the page is wider than the pane, scrolls sideways to the text column. */
	private centreOnText() {
		const { container } = this;
		const overflow = container.scrollWidth - container.clientWidth;
		if (overflow <= 0) return;
		const column = this.column;
		if (!column) {
			container.scrollLeft = overflow / 2;
			return;
		}
		const pageDiv = this.viewer.getPageView(this.viewer.currentPageNumber - 1).div as HTMLElement;
		const pageLeft = pageDiv.getBoundingClientRect().left - container.getBoundingClientRect().left + container.scrollLeft;
		const textCentre = pageLeft + ((column.left + column.right) / 2 / column.width) * pageDiv.offsetWidth;
		container.scrollLeft = Math.min(overflow, Math.max(0, textCentre - container.clientWidth / 2));
	}

	private enableZoomGestures() {
		const { container } = this;

		// Pinch on a trackpad and Ctrl/Cmd + wheel: zoom the page, not the whole site.
		container.addEventListener(
			'wheel',
			(event) => {
				if (!(event.ctrlKey || event.metaKey) || !this.ready || !event.deltaY) return;
				event.preventDefault();
				const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? container.clientHeight : 1);
				this.zoomBy(Math.exp(-Math.max(-300, Math.min(300, pixels)) * 0.002), [event.clientX, event.clientY]);
			},
			{ passive: false },
		);

		// Pinch on a touch screen. PDF.js rounds the scale to two decimals, so the exact
		// scale of the gesture is tracked here; otherwise a slow pinch is lost to rounding.
		let pinchScale = 0;
		try {
			new pdfjsLib.TouchManager({
				container,
				signal: new AbortController().signal,
				onPinching: (origin: [number, number], previous: number, distance: number, dx: number, dy: number) => {
					pinchScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, (pinchScale || this.scale) * (distance / previous)));
					this.fit = pinchScale;
					this.viewer.updateScale({
						// The drawn pages are stretched during the gesture and redrawn once it settles.
						drawingDelay: 150,
						scaleFactor: pinchScale / this.scale,
						origin,
						pan: [dx, dy],
					});
				},
				onPinchEnd: () => {
					pinchScale = 0;
				},
				onPanning: (dx: number, dy: number) => this.viewer.panBy(dx, dy),
			});
			// Two-finger gestures are handled above; one finger still scrolls natively.
			container.style.touchAction = 'pan-x pan-y';
		} catch {
			// Browsers without the APIs TouchManager needs keep their own pinch zoom.
		}
	}

	// --- Finding text --------------------------------------------------------------

	/**
	 * Finds text in the document and highlights every match. A string is looked for as
	 * one phrase, a list as separate words. An empty query clears the highlights.
	 */
	find(query: string | string[]) {
		this.findQuery = query;
		if (!query.length) {
			this.bus.dispatch('findbarclose', { source: this });
			return;
		}
		this.dispatchFind('', false);
	}

	/** Moves to the next or the previous match of the current query. */
	findNext(backwards = false) {
		if (this.findQuery.length) this.dispatchFind('again', backwards);
	}

	private dispatchFind(type: string, findPrevious: boolean) {
		this.bus.dispatch('find', {
			source: this,
			type,
			query: this.findQuery,
			caseSensitive: false,
			entireWord: false,
			highlightAll: true,
			findPrevious,
			matchDiacritics: false,
		});
	}

	private reportFind(state: number | null, count: { current: number; total: number }) {
		this.options.onFind({
			current: count?.current ?? 0,
			total: count?.total ?? 0,
			pending: state === FindState.PENDING,
			notFound: state === FindState.NOT_FOUND,
		});
	}
}
