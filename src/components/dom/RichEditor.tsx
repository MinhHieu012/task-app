'use dom';
// Formatted text editor (daily report, task title and note). A DOM component: inline on web, its own WebView on iOS/Android.
// It runs in a separate JS engine on native, so labels and colours come in as props (no tr()/theme here).
import type { DOMProps } from 'expo/dom';
import { useEffect, useRef, useState } from 'react';

import { textToHtml } from '@/lib/html';

import { plainText, sanitize } from './sanitize';

export type Palette = { fg: string; muted: string; border: string; accent: string; wash: string; surface: string; hover: string; field: string; edge: string; ring: string };
export type EditorLabels = {
  style: string; paragraph: string; heading: string; subheading: string; quote: string;
  bold: string; italic: string; underline: string; strike: string; bullets: string; numbers: string;
  undo: string; redo: string; clear: string; placeholder: string;
};
type Cmd = 'bold' | 'italic' | 'underline' | 'strikeThrough' | 'insertUnorderedList' | 'insertOrderedList' | 'undo' | 'redo' | 'removeFormat';

// Lucide-style strokes, 24x24: the vector icon font isn't available inside the WebView.
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
const TOGGLES: Cmd[] = ['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList'];

export default function RichEditor({ initial, labels, palette, onChange, minHeight = 280, compact }: {
  initial: string;
  labels: EditorLabels;
  palette: Palette;
  onChange: (html: string, text: string) => Promise<void>;
  minHeight?: number;
  /** Title fields: no paragraph styles or undo/redo, so the bar stays a single row on a phone. */
  compact?: boolean;
  dom?: DOMProps;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState<Set<string>>(new Set());
  const [block, setBlock] = useState('p');
  const [empty, setEmpty] = useState(!initial.trim());

  // Uncontrolled: the initial HTML goes in once; later prop updates would re-render and lose the caret.
  // Older notes and titles are plain text, hence textToHtml.
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = sanitize(textToHtml(initial));
    emit(); // the screen needs the plain text even if nothing is edited (e.g. saving the draft as is)
    // Highlight the buttons for wherever the caret is, like a CMS toolbar.
    const sync = () => {
      if (!ref.current?.contains(document.getSelection()?.anchorNode ?? null)) return;
      setOn(new Set(TOGGLES.filter((c) => document.queryCommandState(c))));
      const b = document.queryCommandValue('formatBlock').toLowerCase();
      setBlock(['h2', 'h3', 'blockquote'].includes(b) ? b : 'p');
    };
    document.addEventListener('selectionchange', sync);
    return () => document.removeEventListener('selectionchange', sync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function emit() {
    const html = sanitize(ref.current?.innerHTML ?? '');
    const text = plainText(html);
    setEmpty(!text);
    onChange(html, text);
  }
  // ponytail: document.execCommand is deprecated but still the only built-in rich-text API in every browser/WebView;
  // swap for a Selection/Range based helper if a browser drops it.
  const run = (cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    emit();
  };

  const p = palette;
  const L = labels;
  const btn = (cmd: Cmd, label: string) => (
    <button
      key={cmd}
      type="button"
      className={`re-tool${on.has(cmd) ? ' on' : ''}`}
      title={label}
      aria-label={label}
      aria-pressed={TOGGLES.includes(cmd) ? on.has(cmd) : undefined}
      // mousedown keeps the selection in the editor; click would move focus to the button first.
      onMouseDown={(e) => { e.preventDefault(); run(cmd); }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={cmd === 'bold' ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
        <path d={ICON[cmd]} />
      </svg>
    </button>
  );
  const sep = <span className="re-sep" />;

  return (
    <div className="re" style={{ fontFamily: '"Be Vietnam Pro", system-ui, sans-serif', color: p.fg }}>
      <style>{`
        /* flex: 1 — on native, Expo's #root is a flex row, so the box shrank to its content: a short title gave a narrow field. */
        .re { flex: 1; min-width: 0; background: ${p.field}; border: 1px solid ${p.edge}; border-radius: 12px; overflow: hidden; }
        /* Focus ring drawn wholly inside the box (offset = -width): on native the WebView is exactly the box's size, so any part outside
           (box-shadow 0 0 0 2px) was clipped away on all four sides and only its rounded corners showed. */
        .re:focus-within { outline: 2px solid ${p.ring}; outline-offset: -2px; }
        .re-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 2px; padding: 4px 6px; background: ${p.surface}; border-bottom: 1px solid ${p.border}; }
        .re-tool { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border: none; border-radius: 6px; background: none; color: ${p.muted}; cursor: pointer; padding: 0; }
        .re-tool:hover { background: ${p.hover}; color: ${p.fg}; }
        .re-tool.on { background: ${p.wash}; color: ${p.accent}; }
        .re-tool:focus-visible, .re-style:focus-visible { outline: 2px solid ${p.accent}; outline-offset: 1px; }
        .re-sep { width: 1px; height: 20px; margin: 0 4px; background: ${p.border}; }
        .re-style { height: 32px; padding: 0 8px; border: none; border-radius: 6px; background: none; color: ${p.fg}; font: inherit; font-size: 14px; cursor: pointer; }
        .re-style:hover { background: ${p.hover}; }
        .re-body { position: relative; min-height: ${minHeight}px; padding: ${compact ? '10px 14px' : '14px 16px'}; outline: none; font-size: 16px; line-height: 1.6; overflow-wrap: anywhere; }
        .re-body.empty::before { content: attr(data-placeholder); position: absolute; color: ${p.muted}; pointer-events: none; }
        .re-body h2 { font-size: 19px; margin: 14px 0 4px; font-weight: 600; }
        .re-body h3 { font-size: 17px; margin: 14px 0 4px; font-weight: 600; }
        .re-body p { margin: 0 0 6px; }
        .re-body ul, .re-body ol { margin: 0 0 6px; padding-left: 22px; }
        .re-body blockquote { margin: 0 0 6px; padding-left: 12px; border-left: 3px solid ${p.border}; color: ${p.muted}; }
        .re-body > :first-child { margin-top: 0; }
        .re-body > :last-child { margin-bottom: 0; }
        ::selection { background: ${p.wash}; }
      `}</style>
      <div role="toolbar" className="re-bar">
        {!compact && (
          <>
            <select
              className="re-style"
              aria-label={L.style}
              title={L.style}
              value={block}
              onChange={(e) => { setBlock(e.target.value); run('formatBlock', e.target.value); }}
            >
              <option value="p">{L.paragraph}</option>
              <option value="h2">{L.heading}</option>
              <option value="h3">{L.subheading}</option>
              <option value="blockquote">{L.quote}</option>
            </select>
            {sep}
          </>
        )}
        {btn('bold', L.bold)}
        {btn('italic', L.italic)}
        {btn('underline', L.underline)}
        {btn('strikeThrough', L.strike)}
        {sep}
        {btn('insertUnorderedList', L.bullets)}
        {btn('insertOrderedList', L.numbers)}
        {sep}
        {!compact && btn('undo', L.undo)}
        {!compact && btn('redo', L.redo)}
        {btn('removeFormat', L.clear)}
      </div>
      <div
        ref={ref}
        className={`re-body${empty ? ' empty' : ''}`}
        contentEditable
        // No red squiggles: text mixes Vietnamese, English and jargon the spell checker flags.
        spellCheck={false}
        autoCorrect="off"
        role="textbox"
        aria-multiline
        aria-label={L.placeholder}
        data-placeholder={L.placeholder}
        onInput={emit}
        // Pasting from Word/Docs/web brings styles and scripts: paste as cleaned HTML instead.
        onPaste={(e) => {
          e.preventDefault();
          const html = e.clipboardData.getData('text/html');
          const text = e.clipboardData.getData('text/plain');
          if (html) document.execCommand('insertHTML', false, sanitize(html));
          else document.execCommand('insertText', false, text);
          emit();
        }}
      />
    </div>
  );
}
