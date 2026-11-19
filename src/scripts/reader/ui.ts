// Small pieces of interface shared by the reader's features.

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

/** True on screens where the reader shows one pane and bottom sheets. */
export const narrow = matchMedia('(max-width: 767px)');

let toastTimer = 0;

/** Shows a short message at the bottom of the reader. */
export function toast(text: string) {
	const element = $('reader-toast');
	element.textContent = text;
	element.classList.add('visible');
	window.clearTimeout(toastTimer);
	toastTimer = window.setTimeout(() => element.classList.remove('visible'), 2600);
}

/** Copies text. Returns false when the browser does not allow it. */
export async function copyText(text: string) {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}

interface SheetOptions {
	/** On wide screens the panel sits beside the pages and stays open while reading. */
	docked?: boolean;
	/** Called after the panel opened or closed. */
	onToggle?(open: boolean): void;
}

/**
 * A panel: the chapter list, or the menu.
 *
 * On phones it slides up from the bottom over a backdrop. Escape and a tap on the
 * backdrop close it, and focus returns to the button that opened it. A docked panel
 * behaves like that on phones only.
 */
export class Sheet {
	/** The panel that is open over a backdrop, if any. */
	private static modal: Sheet | null = null;
	private opener: HTMLElement | null = null;

	constructor(
		private readonly element: HTMLElement,
		private readonly options: SheetOptions = {},
	) {
		element.querySelector('[data-close]')?.addEventListener('click', () => this.close());
	}

	/** Closes the panel that is open over a backdrop. Returns whether there was one. */
	static closeModal() {
		const open = Sheet.modal;
		open?.close();
		return open !== null;
	}

	get isOpen() {
		return !this.element.hidden;
	}

	private get isDocked() {
		return this.options.docked === true && !narrow.matches;
	}

	toggle(opener: HTMLElement) {
		if (this.isOpen) this.close();
		else this.show(opener);
	}

	show(opener: HTMLElement) {
		if (this.isOpen) return;
		this.opener = opener;
		opener.setAttribute('aria-expanded', 'true');
		if (!this.isDocked) {
			Sheet.modal?.close(false);
			Sheet.modal = this;
			$('sheet-backdrop').hidden = false;
		}
		this.element.hidden = false;
		this.options.onToggle?.(true);
	}

	close(restoreFocus = true) {
		if (!this.isOpen) return;
		this.element.hidden = true;
		this.opener?.setAttribute('aria-expanded', 'false');
		if (Sheet.modal === this) {
			Sheet.modal = null;
			$('sheet-backdrop').hidden = true;
			if (restoreFocus) this.opener?.focus({ preventScroll: true });
		}
		this.options.onToggle?.(false);
	}
}
