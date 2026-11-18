#!/usr/bin/env node
// Builds src/data/papers.json, the paper list the site publishes, from
// paper-translations/catalog.json.
//
// The catalog records where every file came from on the local machine, so it
// stays out of the repository. Only the fields listed below are copied.
//
// Run with `npm run papers:sync` after adding or replacing a translation.

import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const archiveDir = path.join(root, 'paper-translations');
const catalogPath = path.join(archiveDir, 'catalog.json');
const outputPath = path.join(root, 'src/data/papers.json');

const KINDS = {
	'latex-translation': 'latex',
	'other-local-translation': 'local',
};

async function sizeOf(relativePath) {
	const info = await stat(path.join(archiveDir, relativePath)).catch(() => null);
	if (!info?.isFile()) {
		throw new Error(`${relativePath} is listed in catalog.json but is not in paper-translations/`);
	}
	return info.size;
}

function assertPublishable(id, relativePath) {
	const inside = path.resolve(archiveDir, relativePath).startsWith(archiveDir + path.sep);
	if (path.isAbsolute(relativePath) || !inside || !relativePath.endsWith('.pdf')) {
		throw new Error(`${id}: "${relativePath}" is not a PDF inside paper-translations/`);
	}
}

let catalog;
try {
	catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
} catch (error) {
	if (error.code === 'ENOENT') {
		console.error(
			'paper-translations/catalog.json not found. It is kept out of git, so this script only runs on the machine that holds the archive.',
		);
		process.exit(1);
	}
	throw error;
}

const papers = [];
const seen = new Set();

for (const entry of catalog.papers) {
	const { id, title, pages, category, pdf } = entry;
	if (!/^[A-Za-z0-9][A-Za-z0-9.-]*$/.test(id)) throw new Error(`"${id}" cannot be used in a URL`);
	if (seen.has(id)) throw new Error(`${id} appears twice in catalog.json`);
	seen.add(id);

	const kind = KINDS[category];
	if (!kind) throw new Error(`${id}: unknown category "${category}"`);

	assertPublishable(id, pdf);

	// A bilingual copy is offered next to the translation when the archive has one.
	// Older copies under versions/ are never published.
	const dual =
		entry.files
			.map((file) => file.path)
			.find((p) => p !== pdf && !p.includes('/versions/') && p.endsWith('/paper.dual.pdf')) ?? null;
	if (dual) assertPublishable(id, dual);

	papers.push({
		id,
		title,
		pages,
		kind,
		arxiv: entry.original_url ?? null,
		// `pdf` and `dual` are paths inside paper-translations/; `file` and `dualFile`
		// are the names the site serves them under, in /paper-files/.
		pdf,
		file: `${id}.pdf`,
		bytes: await sizeOf(pdf),
		// True when the only copy in the archive is the bilingual one.
		bilingual: pdf.endsWith('/paper.dual.pdf'),
		dual,
		dualFile: dual ? `${id}.dual.pdf` : null,
		dualBytes: dual ? await sizeOf(dual) : null,
	});
}

papers.sort((a, b) => a.id.localeCompare(b.id));

await writeFile(outputPath, JSON.stringify(papers, null, '\t') + '\n');

const total = papers.reduce((sum, p) => sum + p.bytes + (p.dualBytes ?? 0), 0);
console.log(
	`Wrote ${papers.length} papers to ${path.relative(root, outputPath)} (${(total / 1e6).toFixed(1)} MB of PDFs).`,
);
