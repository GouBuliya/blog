// Publishes the translated PDFs and the PDF.js data files the reader loads at runtime.
//
// The PDFs live in paper-translations/, outside public/, so that the archive keeps a
// single copy of each file. This integration serves them in `astro dev` and copies them
// into the build output:
//
//   /paper-files/<name>.pdf   the PDFs listed in src/data/papers.json
//   /pdfjs/<dir>/<file>       character maps, standard fonts, wasm decoders, ICC profiles

import { createReadStream } from 'node:fs';
import { copyFile, cp, mkdir, readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILES_ROUTE = '/paper-files/';
const PDFJS_ROUTE = '/pdfjs/';
const PDFJS_DIRS = ['cmaps', 'standard_fonts', 'wasm', 'iccs'];

const CONTENT_TYPES = {
	'.pdf': 'application/pdf',
	'.wasm': 'application/wasm',
	'.js': 'text/javascript',
};

async function sendFile(req, res, file) {
	const info = await stat(file).catch(() => null);
	if (!info?.isFile()) {
		res.statusCode = 404;
		res.end('Not found');
		return;
	}

	const size = info.size;
	let start = 0;
	let end = size - 1;

	// PDF.js asks for byte ranges so that it can show the first pages before the
	// whole file has arrived. GitHub Pages supports them, so dev does as well.
	const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
	if (range && (range[1] || range[2])) {
		if (range[1]) {
			start = Number(range[1]);
			if (range[2]) end = Math.min(Number(range[2]), size - 1);
		} else {
			start = Math.max(size - Number(range[2]), 0);
		}
		if (start > end) {
			res.statusCode = 416;
			res.setHeader('Content-Range', `bytes */${size}`);
			res.end();
			return;
		}
		res.statusCode = 206;
		res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
	}

	res.setHeader('Content-Type', CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream');
	res.setHeader('Accept-Ranges', 'bytes');
	res.setHeader('Content-Length', end - start + 1);
	if (req.method === 'HEAD') {
		res.end();
		return;
	}
	createReadStream(file, { start, end }).pipe(res);
}

export default function papers() {
	let root;
	let base;
	let pdfjsDir;

	// Maps each published file name to its location in the archive.
	async function publishedFiles() {
		const list = JSON.parse(await readFile(path.join(root, 'src/data/papers.json'), 'utf8'));
		const files = new Map();
		for (const paper of list) {
			files.set(paper.file, path.join(root, 'paper-translations', paper.pdf));
			if (paper.dualFile) files.set(paper.dualFile, path.join(root, 'paper-translations', paper.dual));
		}
		return files;
	}

	return {
		name: 'papers',
		hooks: {
			'astro:config:done': ({ config }) => {
				root = fileURLToPath(config.root);
				base = config.base.replace(/\/$/, '');
				const require = createRequire(path.join(root, 'package.json'));
				pdfjsDir = path.dirname(require.resolve('pdfjs-dist/package.json'));
			},

			'astro:server:setup': ({ server }) => {
				server.middlewares.use(async (req, res, next) => {
					if (req.method !== 'GET' && req.method !== 'HEAD') return next();

					let pathname;
					try {
						pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
					} catch {
						return next();
					}
					if (base && pathname.startsWith(base + '/')) pathname = pathname.slice(base.length);

					try {
						if (pathname.startsWith(FILES_ROUTE)) {
							const file = (await publishedFiles()).get(pathname.slice(FILES_ROUTE.length));
							if (!file) {
								res.statusCode = 404;
								res.end('Not found');
								return;
							}
							return await sendFile(req, res, file);
						}

						if (pathname.startsWith(PDFJS_ROUTE)) {
							// Only a plain file name directly inside one of the listed directories.
							const [dir, name, ...rest] = pathname.slice(PDFJS_ROUTE.length).split('/');
							if (rest.length || !PDFJS_DIRS.includes(dir) || !/^[\w.-]+$/.test(name ?? '')) {
								res.statusCode = 404;
								res.end('Not found');
								return;
							}
							return await sendFile(req, res, path.join(pdfjsDir, dir, name));
						}
					} catch (error) {
						return next(error);
					}

					next();
				});
			},

			'astro:build:done': async ({ dir, logger }) => {
				const out = fileURLToPath(dir);

				const files = await publishedFiles();
				await mkdir(path.join(out, FILES_ROUTE), { recursive: true });
				let bytes = 0;
				for (const [name, source] of files) {
					const info = await stat(source).catch(() => null);
					if (!info?.isFile()) {
						throw new Error(
							`${path.relative(root, source)} is listed in src/data/papers.json but does not exist. ` +
								'Add the PDF, or run `npm run papers:sync` to rebuild the list.',
						);
					}
					await copyFile(source, path.join(out, FILES_ROUTE, name));
					bytes += info.size;
				}

				for (const name of PDFJS_DIRS) {
					await cp(path.join(pdfjsDir, name), path.join(out, PDFJS_ROUTE, name), { recursive: true });
				}

				logger.info(`Copied ${files.size} PDFs (${(bytes / 1e6).toFixed(1)} MB) and the PDF.js data files.`);
			},
		},
	};
}
