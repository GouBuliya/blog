// The chapter list.
//
// Shows where the reader is, moves to a chapter on a click, and keeps the current
// chapter in view while the paper is scrolled.

import { currentChapter } from '../../utils/reader/outline.mjs';
import type { Chapter } from './config';
import type { Position } from './pane';

export class OutlineList {
	private chapters: Chapter[] = [];
	private buttons: HTMLButtonElement[] = [];
	private current = -1;

	constructor(
		private readonly list: HTMLElement,
		private readonly onSelect: (chapter: Chapter) => void,
	) {}

	/** Replaces the list, for example after switching to the original. */
	setChapters(chapters: Chapter[]) {
		this.chapters = chapters;
		this.current = -1;
		this.buttons = chapters.map((chapter) => {
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'outline-item';
			button.style.setProperty('--level', String(chapter.level - 1));

			const title = document.createElement('span');
			title.textContent = chapter.title;
			const page = document.createElement('span');
			page.className = 'outline-page';
			page.textContent = String(chapter.page);
			button.append(title, page);

			button.addEventListener('click', () => this.onSelect(chapter));
			return button;
		});

		if (this.buttons.length) {
			this.list.replaceChildren(...this.buttons);
		} else {
			const empty = document.createElement('p');
			empty.className = 'outline-empty';
			empty.textContent = '这个版本没有章节目录。';
			this.list.replaceChildren(empty);
		}
	}

	/** Marks the chapter being read. */
	update(position: Position) {
		const index = currentChapter(this.chapters, position);
		if (index === this.current) return;
		this.buttons[this.current]?.removeAttribute('aria-current');
		this.current = index;
		const button = this.buttons[index];
		if (!button) return;
		button.setAttribute('aria-current', 'true');
		this.reveal();
	}

	/** Scrolls the list so that the current chapter can be seen. */
	reveal() {
		const button = this.buttons[this.current];
		// Scrolls the list only: `scrollIntoView` would also move the page behind it.
		const scroller = this.list;
		if (!button || !scroller.clientHeight) return;
		const top = button.offsetTop - scroller.offsetTop;
		if (top < scroller.scrollTop + 8 || top + button.offsetHeight > scroller.scrollTop + scroller.clientHeight - 8) {
			scroller.scrollTop = top - scroller.clientHeight / 3;
		}
	}

	/** Title of the chapter being read, or an empty string before the first one. */
	get currentTitle() {
		return this.chapters[this.current]?.title ?? '';
	}
}
