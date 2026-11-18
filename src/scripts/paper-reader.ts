// The in-site PDF reader, built on the PDF.js viewer components.
//
// The `legacy` builds are used because they still run on the older browser engines
// that in-app browsers on phones tend to ship.
//
// pdf.mjs has to be imported before pdf_viewer.mjs: the viewer reads the library from
// `globalThis.pdfjsLib`, which pdf.mjs sets when it is evaluated.
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
	EventBus,
	LinkTarget,
	PDFHistory,
	PDFLinkService,
	PDFViewer,
} from 'pdfjs-dist/legacy/web/pdf_viewer.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import 'pdfjs-dist/legacy/web/pdf_viewer.css';

const root = document.querySelector<HTMLElement>('#reader')!;
const container = document.querySelector<HTMLDivElement>('#viewer-container')!;
const status = document.querySelector<HTMLElement>('#reader-status')!;
const message = document.querySelector<HTMLElement>('#reader-message')!;
const pageInput = document.querySelector<HTMLInputElement>('#page-number')!;
const pageCount = document.querySelector<HTMLElement>('#page-count')!;
const zoomLevel = document.querySelector<HTMLElement>('#zoom-level')!;
const zoomOut = document.querySelector<HTMLButtonElement>('#zoom-out')!;
const zoomIn = document.querySelector<HTMLButtonElement>('#zoom-in')!;
const fitWidth = document.querySelector<HTMLButtonElement>('#fit-width')!;

const { src, key, assets } = root.dataset as { src: string; key: string; assets: string };

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const eventBus = new EventBus();
const linkService = new PDFLinkService({
	eventBus,
	externalLinkTarget: LinkTarget.BLANK,
	externalLinkRel: 'noopener noreferrer',
});
// Records in-document jumps in the browser history, so that Back returns from a
// reference or a figure to the place the link was followed from.
const pdfHistory = new PDFHistory({ eventBus, linkService });
linkService.setHistory(pdfHistory);

const viewer = new PDFViewer({
	container,
	eventBus,
	linkService,
	// Without the page borders a page can use the full width of a phone screen.
	removePageBorders: true,
});
linkService.setViewer(viewer);

// --- Reading position ---------------------------------------------------------
//
// The position is kept per file in localStorage, in the `page=3&zoom=auto,0,512`
// form PDF.js uses for URL fragments. A saved position and a `#page=3` link are
// therefore restored the same way.

const storageKey = `paper-reader:${key}`;
let restored = false;
let latestPosition: string | null = null;
let saveTimer = 0;

function savedPosition(): string | null {
	try {
		const value = localStorage.getItem(storageKey);
		return value && /^page=\d+/.test(value) ? value : null;
	} catch {
		// Storage can be unavailable, for example in private browsing.
		return null;
	}
}

function savePosition() {
	window.clearTimeout(saveTimer);
	saveTimer = 0;
	if (latestPosition === null) return;
	try {
		localStorage.setItem(storageKey, latestPosition);
	} catch {
		// Reading still works without a saved position.
	}
}

eventBus.on('updateviewarea', ({ location }: { location: { pdfOpenParams: string } }) => {
	if (!restored) return;
	latestPosition = location.pdfOpenParams.slice(1);
	if (!saveTimer) saveTimer = window.setTimeout(savePosition, 500);
});
// Phones often discard a background tab without any further scroll event.
window.addEventListener('pagehide', savePosition);
document.addEventListener('visibilitychange', () => {
	if (document.hidden) savePosition();
});

// --- Toolbar ------------------------------------------------------------------

eventBus.on('pagechanging', ({ pageNumber }: { pageNumber: number }) => {
	pageInput.value = String(pageNumber);
});
eventBus.on('scalechanging', ({ scale }: { scale: number }) => {
	zoomLevel.textContent = `${Math.round(scale * 100)}%`;
});

pageInput.addEventListener('focus', () => pageInput.select());
pageInput.addEventListener('change', () => {
	const requested = Math.round(Number(pageInput.value));
	if (requested >= 1 && requested <= viewer.pagesCount) viewer.currentPageNumber = requested;
	pageInput.value = String(viewer.currentPageNumber);
	// Hands the keyboard back to scrolling, and closes the on-screen keyboard.
	container.focus({ preventScroll: true });
});

zoomOut.addEventListener('click', () => viewer.decreaseScale());
zoomIn.addEventListener('click', () => viewer.increaseScale());
fitWidth.addEventListener('click', () => {
	viewer.currentScaleValue = 'page-width';
});

const FITTED_SCALES = ['auto', 'page-width', 'page-fit'];
window.addEventListener('resize', () => {
	// A scale that is fitted to the window has to be fitted again when it changes,
	// for example when a phone is rotated.
	const value = viewer.currentScaleValue;
	if (FITTED_SCALES.includes(value)) viewer.currentScaleValue = value;
	viewer.update();
});

// --- Pinch to zoom ------------------------------------------------------------

// PDF.js rounds the scale to two decimals. The exact scale of the gesture is tracked
// here so that a slow pinch is not lost to that rounding. Zero when no pinch is active.
let pinchScale = 0;
try {
	new pdfjsLib.TouchManager({
		container,
		onPinching(
			origin: [number, number],
			previousDistance: number,
			distance: number,
			dx: number,
			dy: number,
		) {
			pinchScale = (pinchScale || viewer.currentScale) * (distance / previousDistance);
			viewer.updateScale({
				// Stretches the rendered pages during the gesture and redraws them once it settles.
				drawingDelay: 400,
				scaleFactor: pinchScale / viewer.currentScale,
				origin,
				pan: [dx, dy],
			});
		},
		onPinchEnd() {
			pinchScale = 0;
		},
		onPanning(dx: number, dy: number) {
			viewer.panBy(dx, dy);
		},
		signal: new AbortController().signal,
	});
	// Two-finger gestures are now handled above; one finger still scrolls natively.
	container.style.touchAction = 'pan-x pan-y';
} catch (error) {
	// Browsers without the APIs TouchManager needs keep their own pinch zoom.
	console.warn('Pinch to zoom is handled by the browser:', error);
}

// --- Loading ------------------------------------------------------------------

eventBus.on('pagesinit', () => {
	viewer.currentScaleValue = 'auto';

	const fromUrl = location.hash.slice(1);
	const position = fromUrl || savedPosition();
	if (position) linkService.setHash(position);
	// The fragment has been applied. Removing it lets a later reload return to the
	// position reached by reading, not to the linked page.
	if (fromUrl) history.replaceState(history.state, '', location.pathname + location.search);

	pdfHistory.initialize({ fingerprint: viewer.pdfDocument!.fingerprints[0]! });
	restored = true;

	status.hidden = true;
	for (const control of [pageInput, zoomOut, zoomIn, fitWidth]) control.disabled = false;
	container.focus({ preventScroll: true });
});

async function open() {
	const loadingTask = pdfjsLib.getDocument({
		url: src,
		cMapUrl: `${assets}cmaps/`,
		cMapPacked: true,
		standardFontDataUrl: `${assets}standard_fonts/`,
		wasmUrl: `${assets}wasm/`,
		iccUrl: `${assets}iccs/`,
	});
	loadingTask.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
		if (total > 0) {
			message.textContent = `正在加载… ${Math.min(100, Math.round((loaded / total) * 100))}%`;
		}
	};

	try {
		const pdf = await loadingTask.promise;
		pageCount.textContent = `/ ${pdf.numPages}`;
		pageInput.max = String(pdf.numPages);
		viewer.setDocument(pdf);
		linkService.setDocument(pdf, null);
	} catch (error) {
		console.error(error);
		message.textContent = '加载失败。';
	}
}

open();
