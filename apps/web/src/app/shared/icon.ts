import { ChangeDetectionStrategy, Component, effect, ElementRef, inject, input } from '@angular/core';
import {
  ArrowRight, BookOpen, Calendar, CalendarClock, CalendarDays, ChartColumn, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  Circle, CircleAlert, CircleCheck, CircleHelp, Clock, Ellipsis, Eye, EyeOff, FileText, Flag, Flame, Folder, FolderOpen, Gauge, Grid2x2,
  Inbox, Info, KeyRound, Languages, Link, ListChecks, LogOut, Menu, Moon, Palette, Pencil, Plus, Repeat, Search, Send, Settings, SquareCheck,
  SquarePen, Sun, Tag, Trash2, TrendingUp, TriangleAlert, Trophy, Undo2, Unlink, X,
  type IconNode,
} from 'lucide';

// Only the icons the app uses, so the bundle carries these and not lucide's whole set.
const ICONS = {
  'arrow-right': ArrowRight, book: BookOpen, calendar: Calendar, 'calendar-clock': CalendarClock, 'calendar-days': CalendarDays, chart: ChartColumn,
  check: Check, 'check-check': CheckCheck, 'chevron-down': ChevronDown, 'chevron-left': ChevronLeft, 'chevron-right': ChevronRight, 'chevron-up': ChevronUp,
  circle: Circle, alert: CircleAlert, 'circle-check': CircleCheck, help: CircleHelp, clock: Clock, more: Ellipsis, eye: Eye, 'eye-off': EyeOff,
  file: FileText, flag: Flag, flame: Flame, folder: Folder, 'folder-open': FolderOpen, gauge: Gauge, grid: Grid2x2, inbox: Inbox, info: Info,
  key: KeyRound, languages: Languages, link: Link, list: ListChecks, logout: LogOut, menu: Menu, moon: Moon, palette: Palette, pencil: Pencil,
  plus: Plus, repeat: Repeat, search: Search, send: Send, settings: Settings, subtasks: SquareCheck, edit: SquarePen, sun: Sun, tag: Tag,
  trash: Trash2, trend: TrendingUp, warning: TriangleAlert, trophy: Trophy, undo: Undo2, unlink: Unlink, x: X,
} satisfies Record<string, IconNode>;
export type IconName = keyof typeof ICONS;

const NS = 'http://www.w3.org/2000/svg';

/** A Lucide stroke icon, decorative (aria-hidden): the control around it carries the label. */
@Component({
  selector: 'app-icon',
  template: '',
  styles: ':host { display: inline-flex; flex: none; line-height: 0; } :host ::ng-deep svg { width: 100%; height: 100%; }',
  host: { 'aria-hidden': 'true', '[style.width.px]': 'size()', '[style.height.px]': 'size()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(18);
  readonly stroke = input(2);
  private el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  constructor() {
    effect(() => {
      const svg = document.createElementNS(NS, 'svg');
      const attrs = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': String(this.stroke()), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
      for (const [k, v] of Object.entries(attrs)) svg.setAttribute(k, v);
      for (const [tag, a] of ICONS[this.name()]) {
        const child = document.createElementNS(NS, tag);
        for (const [k, v] of Object.entries(a)) child.setAttribute(k, String(v));
        svg.appendChild(child);
      }
      this.el.replaceChildren(svg);
    });
  }
}
