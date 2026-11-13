// Tags (#nhà, #gấp) and task search. Pure (node-checked).
import { htmlToText } from './html.ts';
import { fold, matches } from './reports.ts';
import type { Task } from './types.ts';

const TAG = /#([\p{L}\p{N}_-]+)/gu;
const norm = (t: string) => t.normalize('NFC').toLowerCase();
const uniq = (a: string[]) => [...new Set(a)];

/** The form's tag field: "#nhà, gấp #Nhà" -> ['nhà', 'gấp']. */
export const parseTags = (s: string) => uniq(s.split(/[\s,]+/).map((t) => norm(t.replace(/^#+/, ''))).filter(Boolean));

/** Quick add: "#tags" anywhere in the text become tags; the rest is the title. */
export function splitTags(text: string) {
  const tags = uniq([...text.matchAll(TAG)].map((m) => norm(m[1])));
  return { title: text.replace(TAG, ' ').replace(/\s+/g, ' ').trim(), tags };
}

export const fmtTags = (tags: string[]) => tags.map((t) => `#${t}`).join(' ');

/** "#nhà gửi mail": tasks tagged nhà whose title or note has "gửi mail". Accent- and case-insensitive. */
export function searchTasks(tasks: Task[], q: string) {
  const words = q.trim().split(/\s+/).filter(Boolean);
  const want = words.filter((w) => w.length > 1 && w.startsWith('#')).map((w) => fold(w.slice(1)));
  const rest = words.filter((w) => !w.startsWith('#')).join(' ');
  if (!want.length && !rest) return [];
  return tasks.filter((t) => {
    const has = t.tags.map(fold);
    return want.every((w) => has.includes(w)) && (!rest || matches(`${t.title}\n${htmlToText(t.note ?? '')}`, rest));
  });
}

/** Every tag in use with how many tasks carry it, most used first. */
export function tagCounts(tasks: Pick<Task, 'tags'>[]) {
  const n = new Map<string, number>();
  for (const t of tasks) for (const tag of t.tags) n.set(tag, (n.get(tag) ?? 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'vi'));
}

// Quick add suggestions: the "#..." being typed at the end of the box.
const TYPING = /#([\p{L}\p{N}_-]*)$/u;

/** Known tags that start with the tag being typed (accent-insensitive), minus ones already in the text. */
export function suggestTags(text: string, known: string[], max = 6) {
  const m = text.match(TYPING);
  if (!m) return [];
  const typed = fold(m[1]);
  const used = new Set(splitTags(text.slice(0, m.index)).tags);
  return known.filter((t) => !used.has(t) && t !== norm(m[1]) && fold(t).startsWith(typed)).slice(0, max);
}

/** Replaces the tag being typed with `tag`, leaving a space to type on. */
export const completeTag = (text: string, tag: string) => text.replace(TYPING, `#${tag} `);
