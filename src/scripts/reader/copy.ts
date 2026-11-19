// Copying text out of the paper.
//
// Text selected in a PDF is copied one typeset line at a time: every line ends in a
// line break, and pasted Chinese is full of stray spaces. The reader copies the way they
// always do (Ctrl/Cmd+C, the context menu, the "Copy" bubble on a phone), and this
// puts the text on the clipboard as running paragraphs.

import { joinLines } from '../../utils/reader/text.mjs';
import { pdfjsLib } from './pane';

interface Line {
	text: string;
	top: number;
	left: number;
	right: number;
	height: number;
	page: number;
}

/**
 * The selected text of the PDF text layer as typeset lines with their place on screen.
 *
 * PDF.js ends each line of the text layer with a `<br>`, which is what the lines are
 * split on. Where a line sits is what tells paragraphs apart afterwards.
 */
function selectedLines(range: Range, container: HTMLElement): Line[] {
	const lines: Line[] = [];
	let line: Line | null = null;
	const end = () => {
		if (line?.text.trim()) lines.push(line);
		line = null;
	};

	const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
		acceptNode: (node) => (range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
	});
	const piece = document.createRange();

	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		if (node instanceof HTMLBRElement) {
			end();
			continue;
		}
		if (!(node instanceof Text) || !node.parentElement?.closest('.textLayer')) continue;

		const from = node === range.startContainer ? range.startOffset : 0;
		const to = node === range.endContainer ? range.endOffset : node.length;
		if (to <= from) continue;

		piece.setStart(node, from);
		piece.setEnd(node, to);
		const rect = piece.getBoundingClientRect();
		const page = Number(node.parentElement.closest<HTMLElement>('.page')?.dataset.pageNumber ?? 0);
		const text = node.data.slice(from, to);

		if (line && line.page !== page) end();
		if (!line) {
			line = { text, top: rect.top, left: rect.left, right: rect.right, height: rect.height, page };
		} else {
			line.text += text;
			line.right = Math.max(line.right, rect.right);
			// Super- and subscripts are shorter; the line is as tall as its tallest piece.
			if (rect.height > line.height) {
				line.height = rect.height;
				line.top = rect.top;
			}
		}
	}
	end();
	return lines;
}

/**
 * Makes copying from the panes give running paragraphs.
 *
 * @param enabled Asked on every copy, so that the reader can switch it off.
 * @param onCopied Called after cleaned text went to the clipboard.
 */
export function cleanCopies(root: HTMLElement, enabled: () => boolean, onCopied: () => void) {
	root.addEventListener(
		'copy',
		(event) => {
			if (!enabled() || !event.clipboardData) return;
			const selection = document.getSelection();
			if (!selection || selection.isCollapsed || !selection.rangeCount) return;
			const range = selection.getRangeAt(0);
			const common = range.commonAncestorContainer;
			const container = (common instanceof Element ? common : common.parentElement)?.closest<HTMLElement>('.pdfViewer');
			if (!container) return;

			// PDFs store "fi" and the like as single ligature characters; the letters are wanted.
			const text = pdfjsLib.normalizeUnicode(joinLines(selectedLines(range, container))).replaceAll('\u0000', '');
			if (!text) return;
			event.clipboardData.setData('text/plain', text);
			event.preventDefault();
			// PDF.js has its own copy handler on the text layer, which would overwrite this.
			event.stopPropagation();
			onCopied();
		},
		// Capturing, to run before the handler PDF.js puts on the text layer.
		true,
	);
}
