## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Paper reader content

Every published paper MUST include a tracked `reading.json` beside its translated PDF. It must contain explicit chapter titles, physical PDF page numbers, levels, normalized vertical positions (0 at the top of the page, 1 at the bottom; PDF bookmarks count from the bottom), and the PDF SHA-256. `npm run papers:outline` drafts or corrects outlines from the PDF bookmarks. Do not depend on runtime PDF bookmark parsing or silently substitute a one-entry outline. Read `docs/paper-reading.md` before adding or replacing papers. Update/review the outline whenever a PDF changes. `papers:sync` and production builds reject absent, invalid, or stale metadata. Include original PDFs and their metadata when providing bilingual comparison; never assume English and Chinese page numbers align.

Run `npm test`, `npm run papers:sync`, and `npm run build` for reader/content changes. Check desktop and narrow mobile layouts, shared links, return from internal links, and reading-position restoration in the rendered reader. Source ZIPs and local provenance records stay ignored by Git.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
