import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			// Transform string to Date object
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			// Drafts are visible in `astro dev` and left out of production builds.
			draft: z.boolean().default(false),
			mathDelimiters: z.literal('latex').optional(),
			citationAuthor: z.string().optional(),
			heroImage: z.optional(image()),
		}),
});

// Translation notes kept next to each paper. They have no frontmatter; the entry id
// is the paper's directory name, which is also its id in src/data/papers.json.
const paperNotes = defineCollection({
	loader: glob({
		base: './paper-translations',
		pattern: '*/notes/*.md',
		generateId: ({ entry }) => entry.split('/')[0],
	}),
});

export const collections = { blog, paperNotes };
