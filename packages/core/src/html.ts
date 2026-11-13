// HTML helpers that run anywhere (no DOMParser): task notes are HTML, but older ones are plain text. Pure (node-checked).

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&${({ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot', "'": '#39' } as Record<string, string>)[c]};`);

export const isHtml = (s: string) => /<\/?[a-z][^>]*>/i.test(s);

/** A plain-text note as paragraphs, so the editor keeps its line breaks. */
export const textToHtml = (s: string) => (isHtml(s) ? s : s.split('\n').map((l) => `<p>${esc(l) || '<br>'}</p>`).join(''));

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' };

/** Readable text of a note for rows and search: one line per block. */
export function htmlToText(s: string) {
  if (!isHtml(s)) return s;
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|h\d|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e: string) => ENT[e])
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/** The one-line plain title stored next to `title_html`, for lists, toasts, reports and search. */
export const titleText = (html: string) => htmlToText(html).replace(/\s+/g, ' ').trim();

/** HTML to edit a title from. `title_html` only if it still matches `title`: anything that sets the plain title
 *  alone (quick add, an older copy) wins over stale formatting. */
export const titleHtml = (t: { title: string; title_html?: string | null }) =>
  t.title_html && titleText(t.title_html) === t.title ? t.title_html : textToHtml(t.title);
