// Searches the text of all papers off the main thread.
//
// The index is downloaded on the first search and kept. The originals have their own,
// larger index, which is only fetched once a search asks for them.

import { searchPapers } from '../../utils/reader/search.mjs';

type Language = 'zh' | 'original';

interface Request {
	id: number;
	query: string;
	originals: boolean;
	urls: Record<Language, string>;
}

const indexes: Partial<Record<Language, Promise<any[]>>> = {};

function load(language: Language, url: string) {
	indexes[language] ??= fetch(url)
		.then((response) => {
			if (!response.ok) throw new Error(`${url}: ${response.status}`);
			return response.json();
		})
		.catch((error) => {
			// Lets the next search try again.
			delete indexes[language];
			throw error;
		});
	return indexes[language]!;
}

self.onmessage = async ({ data }: MessageEvent<Request>) => {
	const { id, query, originals, urls } = data;
	try {
		const documents = await load('zh', urls.zh);
		const all = originals ? documents.concat(await load('original', urls.original)) : documents;
		self.postMessage({ id, result: searchPapers(all, query) });
	} catch (error) {
		console.error(error);
		self.postMessage({ id, failed: true });
	}
};
