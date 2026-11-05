/// <reference types="node" />
// Run: npm test
import assert from 'node:assert/strict';

import { fromIso, localDay, nextDue, parseDate, parseTime } from './dates.ts';
import { dayCounts, groupByProject, monthCounts } from './journal.ts';
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

console.log('logic.check: all assertions passed');
