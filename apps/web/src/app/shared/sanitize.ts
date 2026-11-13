// Allow-list HTML cleaner for report content. Runs only inside DOM components (browser / WebView), where DOMParser
// exists. Every attribute is dropped (no on*, style, href), dangerous elements go with their contents, and any
// other unknown tag is unwrapped so its text survives (pasted Word/Docs markup).
const KEEP = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'H2', 'H3', 'UL', 'OL', 'LI', 'BLOCKQUOTE']);
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'TEMPLATE', 'SVG', 'MATH', 'NOSCRIPT', 'FORM', 'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'IMG', 'VIDEO', 'AUDIO']);
const BLOCK = new Set(['DIV', 'SECTION', 'ARTICLE', 'H1', 'H4', 'H5', 'H6', 'PRE', 'TABLE', 'TR']);

export function sanitize(html: string) {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const clean = (node: Node, into: Node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        into.appendChild(doc.createTextNode(child.textContent ?? ''));
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = (child as Element).tagName.toUpperCase(); // SVG/MathML children keep lowercase names
        if (DROP.has(tag)) continue;
        if (KEEP.has(tag)) {
          const el = doc.createElement(tag === 'STRIKE' ? 's' : tag.toLowerCase());
          clean(child, el);
          into.appendChild(el);
        } else if (BLOCK.has(tag)) {
          // contentEditable makes <div> lines; keep them as paragraphs.
          const p = doc.createElement('p');
          clean(child, p);
          into.appendChild(p);
        } else {
          clean(child, into);
        }
      }
    }
  };
  const out = doc.createElement('div');
  clean(doc.body, out);
  return out.innerHTML;
}

/** Plain text of cleaned HTML, one line per block, for search and the "is it empty" check. */
export function plainText(html: string) {
  const el = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body;
  el.querySelectorAll('p, li, h2, h3, blockquote, br').forEach((b) => b.append('\n'));
  el.querySelectorAll('li > ul, li > ol').forEach((b) => b.before('\n')); // a nested list starts a line, not "đếnVăn"
  return (el.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}
