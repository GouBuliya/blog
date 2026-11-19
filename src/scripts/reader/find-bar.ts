// Finding text in the open paper.
//
// The browser's own find only sees the few pages that are drawn at the moment, so the
// reader has its own. A search result from the paper list opens this bar with the query
// filled in, which is how the reader gets from "page 12 mentions it" to the sentence.

import type { FindStatus, Pane } from './pane';
import { $ } from './ui';

export class FindBar {
	private readonly bar = $('find-bar');
	private readonly input = $<HTMLInputElement>('find-input');
	private readonly count = $('find-count');
	private readonly previous = $<HTMLButtonElement>('find-previous');
	private readonly next = $<HTMLButtonElement>('find-next');
	/** Words to look for separately, when the bar was opened from such a search. */
	private words: string[] | null = null;

	/**
	 * @param pane The pane to search: the one the reader is using.
	 * @param opener The toolbar button, kept in step with the bar.
	 * @param onClose Called after the bar closed.
	 */
	constructor(
		private readonly pane: () => Pane,
		private readonly opener: HTMLElement,
		private readonly onClose: () => void,
	) {
		this.input.addEventListener('input', () => {
			this.words = null;
			this.search();
		});
		this.input.addEventListener('keydown', (event) => {
			if (event.key !== 'Enter') return;
			event.preventDefault();
			this.pane().findNext(event.shiftKey);
		});
		this.previous.addEventListener('click', () => this.pane().findNext(true));
		this.next.addEventListener('click', () => this.pane().findNext());
		$('find-close').addEventListener('click', () => this.close());
	}

	get isOpen() {
		return !this.bar.hidden;
	}

	/**
	 * @param query Fills the field and searches at once. Without it the field keeps what
	 *   was typed before, selected, so that typing replaces it.
	 * @param separateWords Match the words of the query anywhere on a page, not as a phrase.
	 */
	open(query?: string, separateWords = false) {
		this.bar.hidden = false;
		this.opener.setAttribute('aria-expanded', 'true');
		if (query !== undefined) {
			this.input.value = query;
			this.words = separateWords ? query.split(/\s+/).filter(Boolean) : null;
		}
		if (query === undefined) {
			this.input.focus();
			this.input.select();
		}
		this.search();
	}

	close() {
		if (!this.isOpen) return;
		this.bar.hidden = true;
		this.opener.setAttribute('aria-expanded', 'false');
		this.pane().find('');
		this.count.textContent = '';
		this.onClose();
	}

	/** Runs the current query again, after another file was opened in the pane. */
	search() {
		if (!this.isOpen) return;
		const query = this.input.value.trim();
		this.pane().find(this.words ?? query);
		if (!query) this.report({ current: 0, total: 0, pending: false, notFound: false });
	}

	report(status: FindStatus) {
		if (!this.isOpen) return;
		const empty = !this.input.value.trim();
		this.count.textContent = empty ? '' : status.total ? `${status.current} / ${status.total}` : status.pending ? '…' : '无结果';
		this.count.classList.toggle('none', !empty && !status.total && !status.pending);
		this.previous.disabled = this.next.disabled = status.total < 2;
	}
}
