/// <reference types="node" />
// Run: npm test
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { ACCENTS, accentTokens, contrast, DEFAULT_ACCENT, neutral } from './accent.ts';
import { fromIso, localDay, nextDue, parseDate, parseTime, toIso } from './dates.ts';
import { en, setLang, tr } from './i18n.ts';
import { dayCounts, groupByProject, monthCounts } from './journal.ts';
import { answer, confirmAction, notifyStore, toast } from './notify.ts';
import { draftHtml, isLate, matches, reportReminders, reportStats, reportStatus, snippet } from './reports.ts';
import { parseWhen, spanError } from './subtasks.ts';
import type { Project, Task } from './supabase.ts';

// 2026-11-02 is a Monday.
assert.equal(fromIso('2026-11-02').getDay(), 1);
const MON = '2026-11-02', TUE = '2026-11-03', WED = '2026-11-04';

// AE2: 00:30 local on the 4th belongs to the 4th.
assert.equal(localDay(new Date(2026, 10, 4, 0, 30)), '2026-11-04');
assert.equal(localDay(new Date(2026, 10, 3, 23, 59)), '2026-11-03');

// AE1: daily due Monday, ticked Monday -> Tuesday.
assert.equal(nextDue('daily', MON, MON), TUE);
// Daily overdue by 5 days, ticked today -> tomorrow.
assert.equal(nextDue('daily', '2026-10-30', WED), '2026-11-05');
// weekly Mon+Wed.
assert.equal(nextDue('weekly:1,3', MON, MON), WED);
assert.equal(nextDue('weekly:1,3', WED, WED), '2026-11-09');
// Weekly due next Friday, ticked early today -> the Friday after.
assert.equal(nextDue('weekly:5', '2026-11-06', WED), '2026-11-13');
// monthly:31 clamps in short months and returns to the 31st.
assert.equal(nextDue('monthly:31', '2027-01-31', '2027-01-31'), '2027-02-28');
assert.equal(nextDue('monthly:31', '2028-01-31', '2028-01-31'), '2028-02-29');
assert.equal(nextDue('monthly:31', '2027-02-28', '2027-02-28'), '2027-03-31');
assert.equal(nextDue('monthly:15', '2026-12-15', '2026-12-15'), '2027-01-15');
// every:3 due today -> today + 3.
assert.equal(nextDue('every:3', WED, WED), '2026-11-07');

// Typed dates and times.
assert.equal(parseDate('05/12/2026', WED), '2026-12-05');
assert.equal(parseDate('5/12', WED), '2026-12-05');
assert.equal(parseDate('01/02', WED), '2027-02-01'); // already passed this year -> next year
assert.equal(parseDate('31/02', WED), null);
assert.equal(parseDate('31/02/2026', WED), null);
assert.equal(parseDate('abc', WED), null);
assert.equal(parseTime('14:30'), '14:30');
assert.equal(parseTime('9:05'), '09:05');
assert.equal(parseTime('25:00'), null);
assert.equal(parseTime('12:60'), null);

const task = (t: Partial<Task>): Task => ({
  id: Math.random().toString(),
  project_id: null,
  title: 't',
  note: null,
  priority: 4,
  due_date: null,
  due_time: null,
  end_date: null,
  end_time: null,
  repeat: null,
  completed_at: null,
  completed_day: null,
  recurring_copy: false,
  created_at: '2026-11-01T00:00:00Z',
  ...t,
});

// AE2 / R12: due the 3rd, done the 4th -> missed on the 3rd; done the 3rd -> not missed.
const rows = [
  task({ due_date: TUE, completed_day: WED, completed_at: '2026-11-04T00:30:00' }),
  task({ due_date: TUE, completed_day: TUE, completed_at: '2026-11-03T10:00:00' }),
  task({ due_date: TUE }),
  task({ completed_day: TUE, completed_at: '2026-11-03T12:00:00' }), // quick log, no due date
];
assert.deepEqual(dayCounts(rows, TUE), { done: 2, missed: 2 });
assert.deepEqual(dayCounts(rows, WED), { done: 1, missed: 0 });
assert.deepEqual(dayCounts(rows, TUE, TUE), { done: 2, missed: 0 }); // the day isn't over yet

// Grouping: no-project entries go to "Hộp thư" first, then projects by name.
const projects: Project[] = [
  { id: 'p2', name: 'Nhà', created_at: '' },
  { id: 'p1', name: 'Công việc', created_at: '' },
];
const groups = groupByProject(
  [
    task({ title: 'b', project_id: 'p2', completed_day: TUE, completed_at: '2026-11-03T09:00:00' }),
    task({ title: 'a', completed_day: TUE, completed_at: '2026-11-03T08:00:00' }),
    task({ title: 'c', project_id: 'p1', completed_day: TUE, completed_at: '2026-11-03T07:00:00' }),
    task({ title: 'd', project_id: 'gone', completed_day: TUE, completed_at: '2026-11-03T07:00:00' }),
  ],
  projects,
);
assert.deepEqual(
  groups.map((g) => [g.name, g.items.map((i) => i.title)]),
  [
    ['Hộp thư', ['d', 'a']],
    ['Công việc', ['c']],
    ['Nhà', ['b']],
  ],
);

// Month counts: every day present, empty days are 0.
const counts = monthCounts(rows, 2026, 11);
assert.equal(Object.keys(counts).length, 30);
assert.equal(counts['2026-11-01'], 0);
assert.equal(counts[TUE], 2);
assert.equal(counts[WED], 1);

// notify: only the newest three toasts stay; a confirm resolves with the answer, a replaced one with false.
for (const n of [1, 2, 3, 4]) toast(`m${n}`, 't');
assert.deepEqual(notifyStore.get().toasts.map((t) => t.message), ['m2', 'm3', 'm4']);
const first = confirmAction('a');
const second = confirmAction('b');
answer(true);
assert.equal(await first, false);
assert.equal(await second, true);
assert.equal(notifyStore.get().asking, false);

// Subtask spans: parse "DD/MM HH:MM" against the parent's start day, and stay inside the parent.
assert.deepEqual(parseWhen('', TUE), { date: null, time: null });
assert.deepEqual(parseWhen('9:30', TUE), { date: TUE, time: '09:30' });
assert.deepEqual(parseWhen('04/11 14:00', TUE), { date: WED, time: '14:00' });
assert.deepEqual(parseWhen('02/11', TUE), { date: '2027-11-02', time: null }); // before the parent's day -> next year
assert.equal(parseWhen('9:30', null), null); // a time needs a day
assert.equal(parseWhen('25:00', TUE), null);
assert.equal(parseWhen('a b c', TUE), null);
{
  const parent = { due_date: MON, due_time: '09:00:00', end_date: TUE, end_time: '17:00:00' };
  const span = (start_date: string | null, start_time: string | null, end_date: string | null = null, end_time: string | null = null) =>
    spanError(parent, { start_date, start_time, end_date, end_time });
  assert.equal(span(null, null), '');
  assert.equal(span(MON, '09:00', TUE, '17:00'), '');
  assert.equal(span(MON, null), ''); // day only: the parent's start day fits
  assert.equal(span(TUE, null, TUE, null), '');
  assert.match(span(MON, '08:59'), /việc cha/);
  assert.match(span(TUE, '10:00', TUE, '17:01'), /việc cha/);
  assert.match(span(WED, null), /việc cha/);
  assert.match(span(MON, '10:00', MON, '10:00'), /sau lúc bắt đầu/);
  assert.match(span(TUE, null, MON, null), /sau lúc bắt đầu/);
  assert.equal(spanError({ due_date: MON, due_time: null, end_date: null, end_time: null }, { start_date: MON, start_time: '23:59', end_date: null, end_time: null }), '');
  assert.match(spanError({ due_date: null, due_time: null, end_date: null, end_time: null }, { start_date: MON, start_time: null, end_date: null, end_time: null }), /chưa có ngày/);
}

// Daily report: due 21:00 local; 21:00 itself is on time, 21:01 or a later day is late.
const at = (d: string, hm: string) => { const x = fromIso(d); x.setHours(+hm.slice(0, 2), +hm.slice(3), 0, 0); return x; };
assert.equal(isLate('2026-11-09', at('2026-11-09', '21:00')), false);
assert.equal(isLate('2026-11-09', at('2026-11-09', '21:01')), true);
assert.equal(isLate('2026-11-09', at('2026-11-10', '08:00')), true);
// Status: before the first report nothing is missing; today stays pending until the deadline.
assert.equal(reportStatus('2026-11-01', undefined, null, at('2026-11-09', '10:00')), 'none');
assert.equal(reportStatus('2026-11-01', undefined, '2026-11-05', at('2026-11-09', '10:00')), 'none');
assert.equal(reportStatus('2026-11-06', undefined, '2026-11-05', at('2026-11-09', '10:00')), 'missing');
assert.equal(reportStatus('2026-11-09', undefined, '2026-11-05', at('2026-11-09', '20:00')), 'pending');
assert.equal(reportStatus('2026-11-09', undefined, '2026-11-05', at('2026-11-09', '21:30')), 'missing');
assert.equal(reportStatus('2026-11-08', { late: true }, '2026-11-05', at('2026-11-09', '10:00')), 'late');
{
  const reps = [{ day: '2026-11-05', late: false }, { day: '2026-11-07', late: true }, { day: '2026-11-08', late: false }];
  const days = ['2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09'];
  // 09 is pending (morning), so the streak counts back from 08: 08, 07.
  assert.deepEqual(reportStats(days, reps, '2026-11-05', at('2026-11-09', '10:00')), { ontime: 2, late: 1, missing: 1, streak: 2 });
  assert.deepEqual(reportStats(days, [...reps, { day: '2026-11-09', late: false }], '2026-11-05', at('2026-11-09', '22:00')), { ontime: 3, late: 1, missing: 1, streak: 3 });
}
// Draft escapes task titles; search ignores case and Vietnamese marks.
assert.equal(draftHtml([{ name: 'A&B', items: [{ title: '<script>x</script>' }] }], []).includes('<b>A&amp;B</b>: &lt;script&gt;x&lt;/script&gt;'), true);
assert.ok(matches('Họp với khách về báo cáo', 'bao CAO'));
assert.ok(matches('Đường dây', 'duong'));
assert.ok(!matches('Họp team', 'khách'));
assert.equal(snippet('Đã gửi báo cáo tuần cho sếp', 'BAO CAO', 100), 'Đã gửi báo cáo tuần cho sếp');
// Reminders: 20:30 and 21:00, from now on, skipping reported days.
{
  const r = reportReminders(new Set(['2026-11-10']), at('2026-11-09', '20:45'), 3);
  assert.deepEqual(r.map((x) => [toIso(x.at), x.at.getHours() * 60 + x.at.getMinutes(), x.last]), [
    ['2026-11-09', 1260, true], ['2026-11-11', 1230, false], ['2026-11-11', 1260, true],
  ]);
}

// Accent: default kept as is; a light pick is darkened until white text reads; junk falls back to the default.
assert.equal(accentTokens(DEFAULT_ACCENT).primary, DEFAULT_ACCENT);
assert.ok(contrast(accentTokens('#ffe066').primary, '#ffffff') >= 4.5);
assert.equal(accentTokens('red').primary, DEFAULT_ACCENT);
assert.match(accentTokens('#2563B0').light, /^#[0-9a-f]{6}$/);
// Neutrals: untouched under the default accent; under every preset the inks keep their contrast on the sheet.
assert.equal(neutral('#f6f3ee', DEFAULT_ACCENT), '#f6f3ee');
assert.notEqual(neutral('#f6f3ee', '#2563b0'), '#f6f3ee');
for (const { hex } of ACCENTS) {
  const a = accentTokens(hex).primary;
  assert.ok(contrast(neutral('#6b645a', a), '#ffffff') >= 4.5, `muted on ${hex}`);
  assert.ok(contrast(neutral('#948b7e', a), '#ffffff') >= 3, `field edge on ${hex}`);
}

// i18n: Vietnamese is the key, English fills placeholders, a missing entry falls back to the key.
assert.equal(tr('Mỗi {n} ngày', { n: 3 }), 'Mỗi 3 ngày');
setLang('en');
assert.equal(tr('Mỗi {n} ngày', { n: 3 }), 'Every 3 days');
assert.equal(tr('chưa dịch'), 'chưa dịch');
setLang('vi');
// Every quoted Vietnamese string in the app (tr keys and the constants translated at render) has an English entry.
const missing: string[] = [];
const scan = (dir: string): void => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = `${dir}/${e.name}`;
    if (e.isDirectory()) scan(f);
    else if (/\.tsx?$/.test(f) && !/design-system|logic\.check|i18n\.ts/.test(f)) {
      for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
        if (/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line)) continue;
        for (const m of line.matchAll(/'([^'\n]*[À-ỹĐđ][^'\n]*)'/g)) if (!(m[1] in en)) missing.push(`${f}: ${m[1]}`);
      }
    }
  }
};
scan('src'); // npm test runs from the repo root
assert.deepEqual(missing, []);

console.log('logic.check: all assertions passed');
