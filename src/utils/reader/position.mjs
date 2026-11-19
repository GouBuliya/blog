// Reading positions.
//
// A position is a physical page and how far down that page the top of the screen is,
// from 0 (top of the page) to 1 (bottom). It says where the reader is, not how large the
// page is drawn, so a position saved on a laptop or sent in a link suits a phone as well.
//
// Written as `page=4&y=0.42`. The same form is used in links (`#page=4&y=0.42`) and in
// localStorage.

/**
 * @typedef {object} Position
 * @property {number} page 1-based physical page.
 * @property {number} y 0 (top of the page) to 1 (bottom).
 */

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/**
 * Reads a position from a URL fragment or a stored value.
 *
 * Returns null unless the page exists. Anything else in the string is ignored, so a
 * crafted link cannot trigger other PDF open actions.
 *
 * Earlier versions stored the PDF.js form `page=4&zoom=150,0,544`, where the last
 * number is the distance from the bottom of the page in PDF units. It is returned as
 * `legacyTop` for the caller to convert once the page size is known.
 *
 * @returns {{ page: number, y: number | null, legacyTop: number | null } | null}
 */
export function parsePosition(value, pages) {
	if (typeof value !== 'string' || value.length > 300) return null;
	const params = new URLSearchParams(value.replace(/^#/, ''));
	const page = Number(params.get('page'));
	if (!Number.isInteger(page) || page < 1 || page > pages) return null;

	const y = params.has('y') ? Number(params.get('y')) : NaN;
	const legacy = /^[\w-]+(?:\.\d+)?,-?\d+(?:\.\d+)?,(-?\d+(?:\.\d+)?)$/.exec(params.get('zoom') ?? '');

	return {
		page,
		y: Number.isFinite(y) ? clamp(y, 0, 1) : null,
		legacyTop: !Number.isFinite(y) && legacy ? Number(legacy[1]) : null,
	};
}

/** @param {Position} position */
export function formatPosition({ page, y }) {
	const params = new URLSearchParams({ page: String(page) });
	const rounded = Math.round(clamp(y, 0, 1) * 1000) / 1000;
	if (rounded > 0) params.set('y', String(rounded));
	return params.toString();
}

/** A position as one number: pages from the start of the document. */
export const toOffset = ({ page, y }) => page - 1 + y;

/** @returns {Position} */
export function fromOffset(offset, pages) {
	const bounded = clamp(offset, 0, pages - 1e-6);
	const page = Math.floor(bounded) + 1;
	return { page, y: bounded - (page - 1) };
}
