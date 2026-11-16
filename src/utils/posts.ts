import { getCollection } from 'astro:content';

// Posts with `draft: true` show up in `astro dev` but are left out of production builds.
export async function getPublishedPosts() {
	const posts = await getCollection('blog', ({ data }) =>
		import.meta.env.PROD ? data.draft !== true : true,
	);
	return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}
