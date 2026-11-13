import { inject, Injectable } from '@angular/core';
import { localDay, nextDue, today } from '@core/dates';
import { tr } from '@core/i18n';
import { quickFields, type Quick } from '@core/quick';
import { dayCounts } from '@core/journal';
import { isLate } from '@core/reports';
import { uniqueById } from '@core/tasks';
import type { Project, Report, Subtask, Task } from '@core/types';

import { LiveService } from './live';
import { NotifyService } from './notify.service';
import { SupabaseService } from './supabase.service';

/** Every write the web app makes, by domain. Each refreshes the tables it touched (realtime can arrive late)
 *  and moving or destructive actions offer an undo. Same rules and calls as the mobile app. */
@Injectable({ providedIn: 'root' })
export class TasksService {
  private sb = inject(SupabaseService);
  private live = inject(LiveService);
  private notify = inject(NotifyService);
  private get db() {
    return this.sb.client;
  }

  /** Tick or untick. A recurring tick leaves a done copy in the journal and moves the task to its next date. */
  async toggleDone(t: Task) {
    const tasks = this.db.from('tasks');
    const now = new Date();
    const done = { completed_at: now.toISOString(), completed_day: localDay(now) };
    const res = t.completed_at
      ? t.recurring_copy
        ? await tasks.delete().eq('id', t.id)
        : await tasks.update({ completed_at: null, completed_day: null }).eq('id', t.id)
      : t.repeat && t.due_date
        ? await this.db.rpc('complete_recurring', {
            p_task_id: t.id, p_completed_at: done.completed_at, p_completed_day: done.completed_day, p_next_due: nextDue(t.repeat, t.due_date),
          })
        : await tasks.update(done).eq('id', t.id);
    if (this.sb.ok(res)) this.live.refresh('tasks', 'subtasks');
    return !res.error;
  }

  /** Asks, deletes the task (its subtasks go with it), then offers an undo that puts both back with the same ids. */
  async remove(task: Task) {
    const msg = tr('“{name}” sẽ bị xoá. Bạn có vài giây để hoàn tác.', { name: task.title }) + (task.completed_at ? ' ' + tr('Mục này cũng mất khỏi nhật ký.') : '');
    if (!(await this.notify.confirm(tr('Xoá việc này?'), msg))) return false;
    const subs = await this.db.from('subtasks').select('*').eq('task_id', task.id);
    if (!this.sb.ok(subs) || !this.sb.ok(await this.db.from('tasks').delete().eq('id', task.id))) return false;
    this.live.refresh('tasks');
    this.notify.toast(tr('“{name}” đã bị xoá.', { name: task.title }), tr('Đã xoá việc'), 'success', {
      label: tr('Hoàn tác'),
      run: async () => {
        if (!this.sb.ok(await this.db.from('tasks').insert(task))) return;
        if (subs.data?.length) this.sb.ok(await this.db.from('subtasks').insert(subs.data));
        this.live.refresh('tasks', 'subtasks');
      },
    });
    return true;
  }

  /** A one-field change (priority, project), with an undo when it moved the task somewhere. */
  async patch(t: Task, patch: Partial<Task>, undo?: { title: string; message: string }) {
    if (!this.sb.ok(await this.db.from('tasks').update(patch).eq('id', t.id))) return false;
    this.live.refresh('tasks');
    if (undo) {
      const back = Object.fromEntries(Object.keys(patch).map((k) => [k, t[k as keyof Task]]));
      this.notify.toast(undo.message, undo.title, 'success', {
        label: tr('Hoàn tác'),
        run: async () => { if (this.sb.ok(await this.db.from('tasks').update(back).eq('id', t.id))) this.live.refresh('tasks'); },
      });
    }
    return true;
  }

  /** Full save from the task form. */
  async update(id: string, patch: Partial<Task>) {
    const ok = this.sb.ok(await this.db.from('tasks').update(patch).eq('id', id));
    if (ok) this.live.refresh('tasks');
    return ok;
  }

  /** Moves open tasks to new start days through `move_tasks` (ends and subtasks move by the same days), then
   *  offers an undo that puts each back on its own old day. */
  async move(tasks: Task[], to: (t: Task) => string, title: string, message: string) {
    const run = async (pairs: [string, string][]) => {
      const res = await this.db.rpc('move_tasks', { p_ids: pairs.map((p) => p[0]), p_days: pairs.map((p) => p[1]) });
      if (!this.sb.ok(res)) return false;
      this.live.refresh('tasks', 'subtasks');
      return true;
    };
    const moved = tasks.filter((t) => t.due_date);
    if (!(await run(moved.map((t) => [t.id, to(t)])))) return false;
    const back = moved.map((t): [string, string] => [t.id, t.due_date!]);
    this.notify.toast(message, title, 'success', { label: tr('Hoàn tác'), run: () => run(back) });
    return true;
  }

  /** Quick add. No time given: starts now and ends at the end of that day. Typed syntax wins over the screen's
   *  defaults; when logging work already done (journal) a typed date or time means nothing. */
  async quickAdd(q: Quick, defaults: Partial<Task>) {
    const logging = !!defaults.completed_at;
    const day = defaults.due_date ?? today();
    const now = new Date().toTimeString().slice(0, 5);
    const typed = logging ? (q.priority ? { priority: q.priority } : {}) : quickFields(q);
    const { error } = await this.db.from('tasks').insert({ title: q.title, due_date: day, due_time: now, end_date: day, end_time: '23:59:59', ...defaults, ...typed, tags: q.tags });
    if (!error) this.live.refresh('tasks');
    return !error;
  }

  async subtasksOf(taskId: string) {
    const res = await this.db.from('subtasks').select('*').eq('task_id', taskId).order('created_at');
    return this.sb.ok(res) ? (res.data as Subtask[]) : null;
  }
  async addSubtask(taskId: string, title: string) {
    const res = await this.db.from('subtasks').insert({ task_id: taskId, title }).select().single();
    if (this.sb.ok(res)) this.live.refresh('subtasks');
    return res.error ? null : (res.data as Subtask);
  }
  async updateSubtask(id: string, patch: Partial<Subtask>) {
    const ok = this.sb.ok(await this.db.from('subtasks').update(patch).eq('id', id));
    if (ok) this.live.refresh('subtasks');
    return ok;
  }
  async removeSubtask(id: string) {
    const ok = this.sb.ok(await this.db.from('subtasks').delete().eq('id', id));
    if (ok) this.live.refresh('subtasks');
    return ok;
  }

  async projects() {
    const res = await this.db.from('projects').select('*').order('name');
    return this.sb.ok(res) ? (res.data as Project[]) : null;
  }
  async addProject(name: string) {
    const res = await this.db.from('projects').insert({ name: name.trim() }).select().single();
    if (this.sb.ok(res)) this.live.refresh('projects');
    return res.error ? null : (res.data as Project);
  }
  async renameProject(id: string, name: string) {
    const ok = this.sb.ok(await this.db.from('projects').update({ name: name.trim() }).eq('id', id));
    if (ok) this.live.refresh('projects');
    return ok;
  }
  /** Its tasks fall back to the Inbox (project_id on delete set null). */
  async removeProject(p: Project) {
    if (!(await this.notify.confirm(tr('Xoá project “{name}”?', { name: p.name }), tr('Các việc trong project sẽ chuyển về Hộp thư.'), tr('Xoá project')))) return false;
    const ok = this.sb.ok(await this.db.from('projects').delete().eq('id', p.id));
    if (ok) this.live.refresh('projects', 'tasks');
    return ok;
  }

  /** Emptied: the row goes, so an empty note never lingers. */
  async saveNote(day: string, body: string) {
    const res = body
      ? await this.db.from('journal_notes').upsert({ day, body, updated_at: new Date().toISOString() }, { onConflict: 'user_id,day' })
      : await this.db.from('journal_notes').delete().eq('day', day);
    const ok = this.sb.ok(res);
    if (ok) this.live.refresh('journal_notes');
    return ok;
  }

  /** Saves the day's report. Lateness and the submit time are set by the first save only; the counts snapshot
   *  the day's journal so the report list needs no task query. */
  async saveReport(day: string, html: string, body: string, report: Report | undefined, done: Task[], due: Task[]) {
    const now = new Date();
    const { done: doneCount, missed } = dayCounts(uniqueById(done, due), day);
    const res = await this.db.from('daily_reports').upsert(
      {
        day, content: html, body, done_count: doneCount, missed_count: missed, updated_at: now.toISOString(),
        ...(report ? {} : { late: isLate(day, now), submitted_at: now.toISOString() }),
      },
      { onConflict: 'user_id,day' },
    );
    if (!this.sb.ok(res)) return false;
    this.live.refresh('daily_reports');
    this.notify.toast(
      report ? tr('Đã lưu thay đổi.') : isLate(day, now) ? tr('Báo cáo được tính là nộp trễ.') : tr('Đúng hạn, tốt lắm!'),
      report ? tr('Đã lưu báo cáo') : tr('Đã nộp báo cáo'),
      'success',
    );
    return true;
  }
  async removeReport(r: Report) {
    const ok = this.sb.ok(await this.db.from('daily_reports').delete().eq('id', r.id));
    if (ok) this.live.refresh('daily_reports');
    return ok;
  }
}
