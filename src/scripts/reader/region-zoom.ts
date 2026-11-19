// Enlarging a figure, a table or a formula.
//
// The reader drags a box around it on the page. That part of the page is then drawn
// again from the PDF at the size of the screen, so it stays sharp however far it is
// enlarged; stretching what is already on screen would only blur it.

import type { Pane } from './pane';
import { $, narrow } from './ui';

/** A box on one page, as fractions of the page from its top-left corner. */
interface Region {
	page: number;
	x: number;
	y: number;
	width: number;
	height: number;
}

const ZOOM_STEP = 1.5;
const MAX_ZOOM = 6;

export class RegionZoom {
	private readonly hint = $('region-hint');
	private readonly box = $('region-box');
	private readonly dialog = $<HTMLDialogElement>('region-dialog');
	private readonly stage = $('region-stage');
	private readonly canvas = $<HTMLCanvasElement>('region-canvas');
	private readonly label = $('region-label');

	private selecting: { pane: Pane; opener: HTMLElement; stop: AbortController } | null = null;
	private shown: { pane: Pane; region: Region } | null = null;
	private zoom = 1;
	private renderTask: any = null;
	private renderId = 0;

	constructor() {
		$('region-cancel').addEventListener('click', () => this.cancel());
		$('region-close').addEventListener('click', () => this.dialog.close());
		$('region-in').addEventListener('click', () => this.setZoom(this.zoom * ZOOM_STEP));
		$('region-out').addEventListener('click', () => this.setZoom(this.zoom / ZOOM_STEP));
		// A click outside the picture closes it, like any lightbox.
		this.stage.addEventListener('click', (event) => {
			if (event.target === this.stage) this.dialog.close();
		});
		this.dialog.addEventListener('close', () => {
			this.renderTask?.cancel();
			this.shown = null;
			// Frees the memory of a large canvas.
			this.canvas.width = this.canvas.height = 0;
		});
		window.addEventListener('resize', () => this.shown && this.render());
	}

	get isSelecting() {
		return this.selecting !== null;
	}

	/** Lets the reader drag a box on the pages of `pane`. A second call cancels. */
	toggle(pane: Pane, opener: HTMLElement) {
		if (this.selecting) {
			this.cancel();
			return;
		}
		const stop = new AbortController();
		this.selecting = { pane, opener, stop };
		opener.setAttribute('aria-pressed', 'true');
		this.hint.hidden = false;
		pane.container.classList.add('selecting-region');

		let start: { x: number; y: number } | null = null;
		const draw = (event: PointerEvent) => {
			const left = Math.min(start!.x, event.clientX);
			const top = Math.min(start!.y, event.clientY);
			this.box.style.left = `${left}px`;
			this.box.style.top = `${top}px`;
			this.box.style.width = `${Math.abs(event.clientX - start!.x)}px`;
			this.box.style.height = `${Math.abs(event.clientY - start!.y)}px`;
		};
		const options = { signal: stop.signal };

		pane.container.addEventListener(
			'pointerdown',
			(event) => {
				if (event.button !== 0) return;
				event.preventDefault();
				start = { x: event.clientX, y: event.clientY };
				pane.container.setPointerCapture(event.pointerId);
				draw(event);
				this.box.hidden = false;
			},
			options,
		);
		pane.container.addEventListener('pointermove', (event) => start && draw(event), options);
		pane.container.addEventListener(
			'pointerup',
			(event) => {
				if (!start) return;
				const rect = new DOMRect(
					Math.min(start.x, event.clientX),
					Math.min(start.y, event.clientY),
					Math.abs(event.clientX - start.x),
					Math.abs(event.clientY - start.y),
				);
				start = null;
				this.box.hidden = true;
				// A click without a drag is not a selection; the reader can try again.
				if (rect.width < 16 || rect.height < 16) return;
				const region = this.regionAt(pane, rect);
				this.cancel();
				if (region) this.show(pane, region);
			},
			options,
		);
		pane.container.addEventListener(
			'pointercancel',
			() => {
				start = null;
				this.box.hidden = true;
			},
			options,
		);
	}

	cancel() {
		if (!this.selecting) return;
		const { pane, opener, stop } = this.selecting;
		stop.abort();
		pane.container.classList.remove('selecting-region');
		opener.setAttribute('aria-pressed', 'false');
		this.hint.hidden = true;
		this.box.hidden = true;
		this.selecting = null;
	}

	/** The part of the page under a box on screen. The page is the one under its centre. */
	private regionAt(pane: Pane, rect: DOMRect): Region | null {
		const centreX = rect.left + rect.width / 2;
		const centreY = rect.top + rect.height / 2;
		for (const { number, element } of pane.pageElements()) {
			const page = element.getBoundingClientRect();
			if (centreX < page.left || centreX > page.right || centreY < page.top || centreY > page.bottom) continue;
			const left = Math.max(rect.left, page.left);
			const top = Math.max(rect.top, page.top);
			const right = Math.min(rect.right, page.right);
			const bottom = Math.min(rect.bottom, page.bottom);
			return {
				page: number,
				x: (left - page.left) / page.width,
				y: (top - page.top) / page.height,
				width: (right - left) / page.width,
				height: (bottom - top) / page.height,
			};
		}
		return null;
	}

	private show(pane: Pane, region: Region) {
		this.shown = { pane, region };
		this.zoom = 1;
		this.label.textContent = `第 ${region.page} 页`;
		this.dialog.showModal();
		void this.render();
	}

	private setZoom(zoom: number) {
		this.zoom = Math.min(MAX_ZOOM, Math.max(1, zoom));
		void this.render();
	}

	/** Draws the region from the PDF at the size it is shown, times the screen density. */
	private async render() {
		if (!this.shown) return;
		const { pane, region } = this.shown;
		const id = ++this.renderId;
		this.renderTask?.cancel();

		const page = await pane.getPage(region.page);
		if (id !== this.renderId) return;
		const base = page.getViewport({ scale: 1 });
		const regionWidth = region.width * base.width;
		const regionHeight = region.height * base.height;

		// At zoom 1 the region fits the stage; further in, the stage scrolls.
		const fit = Math.min(this.stage.clientWidth / regionWidth, this.stage.clientHeight / regionHeight);
		const cssScale = fit * this.zoom;
		// Phones run out of canvas memory much earlier than desktops.
		const maxPixels = narrow.matches ? 5e6 : 16e6;
		const density = Math.min(
			window.devicePixelRatio || 1,
			Math.sqrt(maxPixels / (regionWidth * regionHeight * cssScale * cssScale)),
		);

		const viewport = page.getViewport({ scale: cssScale * density });
		const canvas = document.createElement('canvas');
		canvas.width = Math.max(1, Math.round(region.width * viewport.width));
		canvas.height = Math.max(1, Math.round(region.height * viewport.height));
		this.renderTask = page.render({
			canvasContext: canvas.getContext('2d')!,
			viewport,
			// Moves the region to the top-left corner of the canvas.
			transform: [1, 0, 0, 1, -region.x * viewport.width, -region.y * viewport.height],
		});
		try {
			await this.renderTask.promise;
		} catch {
			// Cancelled by a newer render or by closing the dialog.
			return;
		}
		if (id !== this.renderId) return;

		this.canvas.width = canvas.width;
		this.canvas.height = canvas.height;
		this.canvas.style.width = `${regionWidth * cssScale}px`;
		this.canvas.style.height = `${regionHeight * cssScale}px`;
		this.canvas.getContext('2d')!.drawImage(canvas, 0, 0);
		$<HTMLButtonElement>('region-out').disabled = this.zoom <= 1;
		$<HTMLButtonElement>('region-in').disabled = this.zoom >= MAX_ZOOM;
	}
}
