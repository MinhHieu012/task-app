import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { textToHtml } from '@core/html';
import { tr } from '@core/i18n';

import { plainText, sanitize } from './sanitize';

type Cmd = 'bold' | 'italic' | 'underline' | 'strikeThrough' | 'insertUnorderedList' | 'insertOrderedList' | 'undo' | 'redo' | 'removeFormat';
const ICON: Record<Cmd, string> = {
  bold: 'M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z',
  italic: 'M19 4h-9M14 20H5M15 4 9 20',
  underline: 'M6 4v6a6 6 0 0 0 12 0V4M4 20h16',
  strikeThrough: 'M16 4H9a3 3 0 0 0-2.83 4M14 12a4 4 0 0 1 0 8H6M4 12h16',
  insertUnorderedList: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  insertOrderedList: 'M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1',
  undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  redo: 'm15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
  removeFormat: 'M4 7V4h16v3M5 20h6M13 4 8 20M15 15l5 5M20 15l-5 5',
};
const LABEL: Record<Cmd, string> = {
  bold: 'Đậm', italic: 'Nghiêng', underline: 'Gạch chân', strikeThrough: 'Gạch ngang', insertUnorderedList: 'Gạch đầu dòng',
  insertOrderedList: 'Danh sách số', undo: 'Hoàn tác', redo: 'Làm lại', removeFormat: 'Xoá định dạng',
};
const TOGGLES: Cmd[] = ['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList'];

/** Formatted text (task title and note, daily report). Uncontrolled: `initial` goes in once; every edit emits
 *  the cleaned HTML and its plain text. Pasted HTML (Word, Docs, web) goes through the same allow-list. */
@Component({
  selector: 'app-rich-editor',
  templateUrl: './rich-editor.html',
  styleUrl: './rich-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RichEditor {
  readonly initial = input('');
  readonly placeholder = input('');
  /** Title fields: no paragraph styles or undo/redo, so the bar stays one row. */
  readonly compact = input(false);
  readonly minHeight = input(200);
  readonly invalid = input(false);
  readonly changed = output<{ html: string; text: string }>();

  private body = viewChild.required<ElementRef<HTMLDivElement>>('body');
  readonly on = signal(new Set<string>());
  readonly block = signal('p');
  readonly empty = signal(true);
  readonly tools = (compact: boolean) => [...TOGGLES.slice(0, 4), null, ...TOGGLES.slice(4), null, ...(compact ? [] : (['undo', 'redo'] as Cmd[])), 'removeFormat' as Cmd];
  readonly icon = ICON;
  readonly label = (c: Cmd) => tr(LABEL[c]);
  readonly tr = tr;

  constructor() {
    afterNextRender(() => {
      this.body().nativeElement.innerHTML = sanitize(textToHtml(this.initial()));
      this.emit(); // the caller needs the plain text even if nothing is edited
    });
    // Light the buttons for wherever the caret is, like a CMS toolbar.
    const sync = () => {
      const el = this.body()?.nativeElement;
      if (!el?.contains(document.getSelection()?.anchorNode ?? null)) return;
      this.on.set(new Set(TOGGLES.filter((c) => document.queryCommandState(c))));
      const b = document.queryCommandValue('formatBlock').toLowerCase();
      this.block.set(['h2', 'h3', 'blockquote'].includes(b) ? b : 'p');
    };
    document.addEventListener('selectionchange', sync);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('selectionchange', sync));
  }

  emit() {
    const html = sanitize(this.body().nativeElement.innerHTML);
    const text = plainText(html);
    this.empty.set(!text);
    this.changed.emit({ html, text });
  }

  // ponytail: document.execCommand is deprecated but still the only built-in rich-text API in every browser;
  // swap for a Selection/Range helper if a browser drops it.
  run(cmd: string, arg?: string) {
    this.body().nativeElement.focus();
    document.execCommand(cmd, false, arg);
    this.emit();
  }

  paste(e: ClipboardEvent) {
    e.preventDefault();
    const html = e.clipboardData?.getData('text/html');
    if (html) document.execCommand('insertHTML', false, sanitize(html));
    else document.execCommand('insertText', false, e.clipboardData?.getData('text/plain') ?? '');
    this.emit();
  }

  /** Enter in a title field would start a new paragraph; it submits nothing either, so it just stays one line. */
  keydown(e: KeyboardEvent) {
    if (this.compact() && e.key === 'Enter') e.preventDefault();
  }
}
