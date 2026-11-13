// Quick add syntax: "Họp nhóm mai 9h !1 #công-việc" -> title "Họp nhóm", tomorrow 09:00, priority 1, tag.
// Pure (node-checked). Each kind is taken once (the first match); anything not understood stays in the title.
import { addDays, fromIso, nextMonday, parseDate, today } from './dates.ts';
import { splitTags } from './tags.ts';

export type Quick = { title: string; tags: string[]; date?: string; time?: string; priority?: 1 | 2 | 3 };

const WEEKDAY: Record<string, number> = { cn: 0, 'chủ nhật': 0, t2: 1, t3: 2, t4: 3, t5: 4, t6: 5, t7: 6 };
const THU: Record<string, number> = { '2': 1, hai: 1, '3': 2, ba: 2, '4': 3, tư: 3, '5': 4, năm: 4, '6': 5, sáu: 5, '7': 6, bảy: 6 };

/** The next given weekday strictly after `from` ("thứ 3" said on a Tuesday means next week). */
const nextWeekday = (from: string, wd: number) => {
  let d = addDays(from, 1);
  while (fromIso(d).getDay() !== wd) d = addDays(d, 1);
  return d;
};

export function parseQuick(text: string, todayIso = today()): Quick {
  const { title: rest, tags } = splitTags(text);
  const words = rest.split(' ').filter(Boolean);
  const out: Quick = { title: '', tags };
  const keep: string[] = [];
  const low = (i: number) => (words[i] ?? '').toLowerCase().normalize('NFC');

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const l = low(i);
    const two = `${l} ${low(i + 1)}`;
    let date: string | null = null;
    let used = 1;

    // Dates. Bare "mai" only in lowercase: "chị Mai" is a name.
    if (two === 'hôm nay') [date, used] = [todayIso, 2];
    else if (two === 'ngày mai') [date, used] = [addDays(todayIso, 1), 2];
    else if (two === 'ngày kia') [date, used] = [addDays(todayIso, 2), 2];
    else if (two === 'tuần sau') [date, used] = [nextMonday(todayIso), 2];
    else if (l === 'thứ' && low(i + 1) in THU) [date, used] = [nextWeekday(todayIso, THU[low(i + 1)]), 2];
    else if (two in WEEKDAY) [date, used] = [nextWeekday(todayIso, WEEKDAY[two]), 2];
    else if (w === 'mai') date = addDays(todayIso, 1);
    else if (l === 'mốt') date = addDays(todayIso, 2);
    else if (l in WEEKDAY) date = nextWeekday(todayIso, WEEKDAY[l]);
    else if (/^\d{1,2}\/\d{1,2}(\/\d{4})?$/.test(w)) date = parseDate(w, todayIso);
    if (date && !out.date) {
      out.date = date;
      i += used - 1;
      continue;
    }

    // Times: 9h, 9h30, 09:30, optionally after "lúc".
    const t = (l === 'lúc' ? low(i + 1) : l).match(/^(\d{1,2})(?:h(\d{2})?|:(\d{2}))$/);
    if (t && !out.time && +t[1] < 24 && +(t[2] ?? t[3] ?? 0) < 60) {
      out.time = `${t[1].padStart(2, '0')}:${t[2] ?? t[3] ?? '00'}`;
      if (l === 'lúc') i++;
      continue;
    }

    const p = l.match(/^!([1-3])$/);
    if (p && !out.priority) {
      out.priority = Number(p[1]) as 1 | 2 | 3;
      continue;
    }
    keep.push(w);
  }
  out.title = keep.join(' ');
  return out;
}

/** What the box understood, as task fields over the screen's defaults. A time with no date means today. */
export function quickFields(q: Quick, todayIso = today()) {
  const f: { due_date?: string; due_time?: string | null; end_date?: string | null; end_time?: string | null; priority?: number } = {};
  if (q.date || q.time) {
    f.due_date = q.date ?? todayIso;
    // A day without a time is all day; with a time it runs to the end of that day, like a plain quick add.
    f.due_time = q.time ?? null;
    f.end_date = q.time ? f.due_date : null;
    f.end_time = q.time ? '23:59:59' : null;
  }
  if (q.priority) f.priority = q.priority;
  return f;
}

/** Example tokens the quick add panel offers as chips. Vietnamese in every language: the parser reads only these. */
export const EXAMPLES = { tomorrow: 'mai', weekday: 'thứ 6', day: '20/11', time: '9h', priority: '!1', tag: '#' };
