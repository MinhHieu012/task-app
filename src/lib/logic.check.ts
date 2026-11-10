/// <reference types="node" />
// Run: npm test
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { ACCENTS, accentTokens, contrast, DARK_SURFACE, DEFAULT_ACCENT, neutral } from './accent.ts';
import { daysIn, dayTitle, nextMonday, fmtDate, fromIso, greeting, localDay, monthGrid, nextDue, parseDate, parseTime, periodRange, shiftPeriod, spanRange, toIso } from './dates.ts';
import { htmlToText, isHtml, textToHtml, titleHtml, titleText } from './html.ts';
import { en, setLang, tr } from './i18n.ts';
import { dayCounts, groupByProject, monthCounts, periodStats } from './journal.ts';
import { answer, confirmAction, notifyStore, toast } from './notify.ts';
import { draftHtml, isLate, matches, reportReminders, reportStats, reportStatus, snippet } from './reports.ts';
import { fmtSpan, spanError, spanLength, subStatus } from './subtasks.ts';
import type { Project, Task } from './supabase.ts';
import { parseQuick, quickFields } from './quick.ts';
import { completeTag, fmtTags, parseTags, searchTasks, splitTags, suggestTags, tagCounts } from './tags.ts';

// 2026-11-02 is a Monday.
assert.equal(fromIso('2026-11-02').getDay(), 1);
const MON = '2026-11-02', TUE = '2026-11-03', WED = '2026-11-04';

// spanRange: Upcoming ranges start tomorrow; quarters/years end on their last day.
assert.deepEqual(spanRange('3d', '2026-11-09'), ['2026-11-10', '2026-11-12']);
assert.deepEqual(spanRange('1w', '2026-11-09'), ['2026-11-10', '2026-11-16']);
assert.deepEqual(spanRange('1m', '2026-01-31'), ['2026-02-01', '2026-02-28']); // clamps to a short month
assert.deepEqual(spanRange('1m', '2026-12-15'), ['2026-12-16', '2027-01-15']);
assert.deepEqual(spanRange('q', '2026-11-09'), ['2026-11-10', '2026-12-31']);
assert.deepEqual(spanRange('q', '2026-11-09', 1), ['2027-01-01', '2027-03-31']);
assert.deepEqual(spanRange('y', '2026-11-09', 1), ['2027-01-01', '2027-12-31']);
assert.deepEqual(spanRange('q', '2026-12-31'), ['2027-01-01', '2026-12-31']); // last day of a quarter: empty range

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
  title_html: null,
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
  tags: [],
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

// Subtask spans: shown as text, and must stay inside the parent.
assert.equal(fmtSpan({ start_date: null, start_time: null, end_date: null, end_time: null }), '');
assert.equal(fmtSpan({ start_date: TUE, start_time: '09:00:00', end_date: TUE, end_time: '10:30:00' }), '03/11 09:00 – 10:30');
assert.equal(fmtSpan({ start_date: TUE, start_time: '22:00', end_date: WED, end_time: '02:00' }), '03/11 22:00 – 04/11 02:00');
assert.equal(fmtSpan({ start_date: TUE, start_time: null, end_date: null, end_time: null }), '03/11');
{
  const sub = (start_time: string | null, end_time: string | null, end_date: string | null = null, done = false) => ({ start_date: TUE, start_time, end_date, end_time, done });
  assert.equal(subStatus(sub('09:00', '10:00'), `${TUE} 10:01`), 'late');
  assert.equal(subStatus(sub('09:00', '10:00'), `${TUE} 09:30`), 'now');
  assert.equal(subStatus(sub('09:00', '10:00'), `${TUE} 08:59`), '');
  assert.equal(subStatus(sub('09:00', '10:00', null, true), `${WED} 00:00`), '');
  assert.equal(subStatus(sub(null, null), `${TUE} 23:00`), 'now'); // day only: open all day
  assert.equal(spanLength(sub('09:00', '09:45')), '45 phút');
  assert.equal(spanLength(sub('09:00', '10:30')), '1h30');
  assert.equal(spanLength(sub('22:00', '02:00', WED)), '4h');
  assert.equal(spanLength(sub('09:00', null)), '');
}
// monthGrid: Nov 2026 starts on a Sunday -> 6 blanks, 30 days.
{
  const g = monthGrid(2026, 11);
  assert.equal(g.length, 36);
  assert.equal(g[6], '2026-11-01');
  assert.equal(g.at(-1), '2026-11-30');
  assert.equal(monthGrid(2026, 2).filter(Boolean).length, 28);
}
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

assert.equal(fmtDate('2026-11-09'), '09/11/2026');
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
  assert.deepEqual(reportStats(days, reps, '2026-11-05', at('2026-11-09', '10:00')), { ontime: 2, late: 1, missing: 1, streak: 2, ontimeStreak: 1 });
  assert.deepEqual(reportStats(days, [...reps, { day: '2026-11-09', late: false }], '2026-11-05', at('2026-11-09', '22:00')), { ontime: 3, late: 1, missing: 1, streak: 3, ontimeStreak: 2 });
  // A late report today ends the on-time run at once.
  assert.equal(reportStats(days, [...reps, { day: '2026-11-09', late: true }], '2026-11-05', at('2026-11-09', '22:00')).ontimeStreak, 0);
}
// Draft escapes task titles; search ignores case and Vietnamese marks.
// Notes: HTML now, plain text before; both read back as text.
assert.equal(isHtml('a < b'), false);
assert.equal(textToHtml('a & b\n\nc'), '<p>a &amp; b</p><p><br></p><p>c</p>');
assert.equal(textToHtml('<p>x</p>'), '<p>x</p>');
assert.equal(htmlToText('<p>Mua <b>rau</b> &amp; thịt</p><ul><li>một</li><li>hai</li></ul><p><br></p>'), 'Mua rau & thịt\nmột\nhai');
assert.equal(htmlToText('chữ thường\ncũ'), 'chữ thường\ncũ');
assert.equal(titleText('<p>PR <b>#21</b>:</p><ul><li>Tag</li><li>Tìm  kiếm</li></ul>'), 'PR #21: Tag Tìm kiếm');
assert.equal(titleHtml({ title: 'PR #21', title_html: '<p><b>PR</b> #21</p>' }), '<p><b>PR</b> #21</p>');
assert.equal(titleHtml({ title: 'Đổi tên', title_html: '<p><b>PR</b> #21</p>' }), '<p>Đổi tên</p>'); // stale formatting dropped
assert.equal(titleHtml({ title: 'a<b', title_html: null }), '<p>a&lt;b</p>');
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

// Tags: quick add pulls #tags out of the title; the form field takes spaces or commas; search filters by both.
assert.deepEqual(splitTags('Gửi mail #Công-việc cho sếp #gấp #gấp'), { title: 'Gửi mail cho sếp', tags: ['công-việc', 'gấp'] });
assert.deepEqual(splitTags('Họp lúc 9h'), { title: 'Họp lúc 9h', tags: [] });
assert.deepEqual(parseTags('#nhà, gấp  #Nhà'), ['nhà', 'gấp']);
assert.equal(fmtTags(['nhà', 'gấp']), '#nhà #gấp');
{
  const ts = [task({ title: 'Gửi báo cáo', tags: ['công-việc'] }), task({ title: 'Đi chợ', note: 'mua rau', tags: ['nhà'] }), task({ title: 'Dọn nhà', tags: ['nhà', 'gấp'] })];
  assert.deepEqual(searchTasks(ts, 'bao cao').map((t) => t.title), ['Gửi báo cáo']);
  assert.deepEqual(searchTasks(ts, 'RAU').map((t) => t.title), ['Đi chợ']); // the note counts
  assert.deepEqual(searchTasks([task({ title: 'x', note: '<p><b>mua</b> rau</p>' })], 'mua rau').length, 1); // HTML note, tags ignored
  assert.deepEqual(searchTasks(ts, '#nha').map((t) => t.title), ['Đi chợ', 'Dọn nhà']); // tags fold accents too
  assert.deepEqual(searchTasks(ts, '#nhà #gấp').map((t) => t.title), ['Dọn nhà']);
  assert.deepEqual(searchTasks(ts, '#nhà chợ').map((t) => t.title), ['Đi chợ']);
  assert.deepEqual(searchTasks(ts, '  '), []);
  assert.deepEqual(tagCounts(ts), [['nhà', 2], ['công-việc', 1], ['gấp', 1]]);
}

// Quick add suggests known tags for the "#..." being typed, and completes it.
{
  const known = ['nhà', 'nhanh', 'gấp', 'công-việc'];
  assert.deepEqual(suggestTags('Đi chợ #nh', known), ['nhà', 'nhanh']);
  assert.deepEqual(suggestTags('Đi chợ #NHA', known), ['nhà', 'nhanh']); // case and accents ignored
  assert.deepEqual(suggestTags('Đi chợ #', known), known); // just "#": everything
  assert.deepEqual(suggestTags('#nhà dọn #nh', known), ['nhanh']); // already used: left out
  assert.deepEqual(suggestTags('#nhà', known), ['nhanh']); // typed in full: no need to suggest it
  assert.deepEqual(suggestTags('Đi chợ', known), []);
  assert.deepEqual(suggestTags('#nh xong', known), []); // only the word at the end
  assert.equal(completeTag('Đi chợ #nh', 'nhà'), 'Đi chợ #nhà ');
}

// Quick add syntax. 2026-11-10 is a Tuesday.
{
  const T = '2026-11-10';
  assert.deepEqual(parseQuick('Họp nhóm mai 9h !1 #công-việc', T), { title: 'Họp nhóm', tags: ['công-việc'], date: '2026-11-11', time: '09:00', priority: 1 });
  assert.deepEqual(parseQuick('Gọi chị Mai', T), { title: 'Gọi chị Mai', tags: [] }); // a name, not tomorrow
  assert.equal(parseQuick('Nộp thuế ngày mai', T).date, '2026-11-11');
  assert.equal(parseQuick('Đi khám mốt', T).date, '2026-11-12');
  assert.equal(parseQuick('Báo cáo thứ 6', T).date, '2026-11-13');
  assert.equal(parseQuick('Báo cáo Thứ Sáu', T).date, '2026-11-13');
  assert.equal(parseQuick('Họp thứ 3', T).date, '2026-11-17'); // today is Tuesday: next week's
  assert.equal(parseQuick('Đá bóng cn', T).date, '2026-11-15');
  assert.equal(parseQuick('Đi chơi chủ nhật', T).date, '2026-11-15');
  assert.equal(parseQuick('Lên kế hoạch tuần sau', T).date, '2026-11-16');
  assert.equal(parseQuick('Sinh nhật 20/11', T).date, '2026-11-20');
  assert.deepEqual(parseQuick('Họp lúc 14h30', T), { title: 'Họp', tags: [], time: '14:30' });
  assert.equal(parseQuick('Gọi 9:05', T).time, '09:05');
  assert.equal(parseQuick('Chạy 25h', T).time, undefined); // not a time: stays in the title
  assert.equal(parseQuick('Chạy 25h', T).title, 'Chạy 25h');
  assert.equal(parseQuick('Đọc chương !4', T).title, 'Đọc chương !4');
  assert.equal(parseQuick('mai mai', T).title, 'mai'); // one date only; the second stays
  assert.equal(nextMonday('2026-11-16'), '2026-11-23'); // a Monday: the one after
  // Fields: a day alone is all day; a time alone is today; nothing parsed changes nothing.
  assert.deepEqual(quickFields(parseQuick('A mai', T), T), { due_date: '2026-11-11', due_time: null, end_date: null, end_time: null });
  assert.deepEqual(quickFields(parseQuick('A 9h !2', T), T), { due_date: T, due_time: '09:00', end_date: T, end_time: '23:59:59', priority: 2 });
  assert.deepEqual(quickFields(parseQuick('A', T), T), {});
}

// Stats periods: weeks run Monday to Sunday, months are calendar months; shifting crosses years.
assert.deepEqual(periodRange('week', '2026-11-08'), ['2026-11-02', '2026-11-08']); // a Sunday stays in its week
assert.deepEqual(periodRange('week', MON), [MON, '2026-11-08']);
assert.deepEqual(periodRange('month', '2026-02-14'), ['2026-02-01', '2026-02-28']);
assert.equal(shiftPeriod('week', WED, -1), '2026-10-26');
assert.equal(shiftPeriod('month', '2026-12-31', 1), '2027-01-01');
assert.equal(daysIn(MON, WED).length, 3);
{
  // rows: two due Tuesday, one done on time, one done late; one due Tuesday never done; one quick log.
  const st = periodStats(rows, daysIn(MON, WED), projects, '2026-11-05');
  assert.deepEqual(st.perDay, [0, 2, 1]);
  assert.equal(st.done, 3);
  assert.equal(st.missed, 2);
  assert.equal(st.rate, 1 / 3);
  assert.deepEqual(st.byProject, [{ id: null, name: 'Hộp thư', n: 3 }]);
  assert.equal(periodStats([], daysIn(MON, WED), projects, '2026-11-05').rate, null);
}

// Accent: default kept as is; a light pick is darkened until white text reads; junk falls back to the default.
assert.equal(accentTokens(DEFAULT_ACCENT).primary, DEFAULT_ACCENT);
assert.ok(contrast(accentTokens('#ffe066').primary, '#ffffff') >= 4.5);
assert.equal(accentTokens('red').primary, DEFAULT_ACCENT);
// Dark theme: every preset reads as text on the dark sheet.
for (const { hex } of ACCENTS) assert.ok(contrast(accentTokens(hex, true).primary, DARK_SURFACE) >= 4.5, `dark ${hex}`);
assert.match(accentTokens('#2563B0').light, /^#[0-9a-f]{6}$/);
// Neutrals: untouched under terracotta (what they were tuned for); under every preset the inks keep their contrast on the sheet.
assert.equal(neutral('#f6f3ee', '#b04a24'), '#f6f3ee'); // tuned for terracotta: unchanged there
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
// Splash / top bar: day title and greeting follow the language.
assert.equal(dayTitle('2026-11-10'), 'Tuesday, 10/11');
assert.equal(greeting(9), 'Good morning');
setLang('vi');
assert.equal(dayTitle('2026-11-10'), 'Thứ Ba, 10/11');
assert.equal(greeting(4), 'Chào buổi tối');
assert.equal(greeting(5), 'Chào buổi sáng');
assert.equal(greeting(12), 'Chào buổi chiều');
assert.equal(greeting(18), 'Chào buổi tối');
// Every quoted Vietnamese string in the app (quick.ts holds syntax words, not UI text) (tr keys and the constants translated at render) has an English entry.
const missing: string[] = [];
const scan = (dir: string): void => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = `${dir}/${e.name}`;
    if (e.isDirectory()) scan(f);
    else if (/\.tsx?$/.test(f) && !/design-system|logic\.check|i18n\.ts|quick\.ts/.test(f)) {
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
