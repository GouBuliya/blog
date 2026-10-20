import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { createMarkdownProcessor, parseFrontmatter } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkLatexDelimiters from './remark-latex-delimiters.mjs';

const options = { syntaxHighlight: false, rehypePlugins: [rehypeKatex] };
const original = await createMarkdownProcessor({ ...options, remarkPlugins: [remarkMath] });
const extended = await createMarkdownProcessor({
  ...options, remarkPlugins: [remarkLatexDelimiters, remarkMath],
});
const enabled = { frontmatter: { mathDelimiters: 'latex' } };

test('renders inline and display LaTeX through existing KaTeX', async () => {
  const { code } = await extended.render(String.raw`Inline \(x_i^2\).

\[
S_t=S_{t-1}+v_tk_t^\top
\]`, enabled);
  assert.equal((code.match(/class="katex"/g) ?? []).length, 2);
  assert.equal((code.match(/class="katex-display"/g) ?? []).length, 1);
  assert.doesNotMatch(code, /katex-error/);
});

test('does not reinterpret literal code, HTML, links or existing dollar math', async () => {
  const source = '`\\(code\\)`\n\n```text\n\\[code\\]\n```\n\n'
    + '    \\(indented\\)\n\n<div>\\(html\\)</div>\n\n'
    + '[literal \\(link\\)](https://example.com)\n\n$x_i$\n\n$$\ny^2\n$$';
  assert.equal((await extended.render(source, enabled)).code, (await original.render(source)).code);
});

test('keeps escaped and unmatched delimiters unchanged', async () => {
  const source = String.raw`Literal \\(x\\), unmatched \(y, and \[z.`;
  assert.equal((await extended.render(source, enabled)).code, (await original.render(source)).code);
});

test('requires explicit opt-in', async () => {
  const source = String.raw`Keep \(x\) as legacy Markdown.`;
  assert.equal((await extended.render(source)).code, (await original.render(source)).code);
});

test('all existing non-opted-in posts retain identical HTML', async () => {
  const directory = new URL('../content/blog/', import.meta.url);
  for (const name of await readdir(directory)) {
    if (!name.endsWith('.md')) continue;
    const { content, frontmatter } = parseFrontmatter(await readFile(new URL(name, directory), 'utf8'));
    if (frontmatter.mathDelimiters === 'latex') continue;
    const opts = { frontmatter };
    assert.equal((await extended.render(content, opts)).code, (await original.render(content, opts)).code, name);
  }
});

test('Delta-CyFA display math does not absorb surrounding prose', async () => {
  const source = await readFile(new URL('../content/blog/delta-cyfa.md', import.meta.url), 'utf8');
  const { content, frontmatter } = parseFrontmatter(source);
  const { code } = await extended.render(content, { frontmatter });
  assert.doesNotMatch(code, /katex-error/);
  assert.equal((code.match(/class="katex-display"/g) ?? []).length, (content.match(/^\\\[$/gm) ?? []).length);
  assert.match(code, /跨圈混叠：从点状 sink 到海绵层/);
});
