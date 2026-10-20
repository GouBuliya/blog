const literalTypes = new Set([
  'code', 'inlineCode', 'html', 'definition', 'link', 'image', 'math', 'inlineMath',
]);

export default function remarkLatexDelimiters() {
  const parse = this.parser;

  this.parser = (source, file) => {
    if (file.data.astro?.frontmatter?.mathDelimiters !== 'latex') {
      return parse(source, file);
    }

    // Use Markdown positions to leave code, HTML, links and existing math alone.
    const ranges = [];
    function collect(node) {
      if (literalTypes.has(node.type)) {
        ranges.push([node.position.start.offset, node.position.end.offset]);
        return;
      }
      for (const child of node.children ?? []) collect(child);
    }
    collect(parse(source, file));

    function convert(text) {
      return text.replace(
        /(?<!\\)\\\[([\s\S]*?)(?<!\\)\\\]|(?<!\\)\\\(([^\n]*?)(?<!\\)\\\)/g,
        (_, block, inline) => block !== undefined
          ? `$$\n${block.trim()}\n$$`
          : `$${inline}$`,
      );
    }

    let normalized = '';
    let cursor = 0;
    for (const [start, end] of ranges) {
      normalized += convert(source.slice(cursor, start)) + source.slice(start, end);
      cursor = end;
    }
    normalized += convert(source.slice(cursor));
    file.value = normalized;
    return parse(normalized, file);
  };
}
