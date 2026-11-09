'use dom';
// Formatted text editor for the daily report. A DOM component: inline on web, its own WebView on iOS/Android.
// It runs in a separate JS engine on native, so labels and colours come in as props (no tr()/theme here).
import type { DOMProps } from 'expo/dom';
import { useEffect, useRef } from 'react';

import { plainText, sanitize } from './sanitize';

export type Palette = { fg: string; muted: string; border: string; accent: string; wash: string; surface: string; hover: string };
type Tool = { cmd: string; arg?: string; label: string; glyph: string };

export default function RichEditor({ initial, labels, palette, onChange }: {
  initial: string;
  labels: { bold: string; italic: string; underline: string; heading: string; bullets: string; numbers: string; placeholder: string };
  palette: Palette;
  onChange: (html: string, text: string) => Promise<void>;
  dom?: DOMProps;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Uncontrolled: the initial HTML goes in once; later prop updates would re-render and lose the caret.
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = sanitize(initial);
    emit(); // the screen needs the plain text even if nothing is edited (e.g. saving the draft as is)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function emit() {
    const html = sanitize(ref.current?.innerHTML ?? '');
    onChange(html, plainText(html));
  }
  // ponytail: document.execCommand is deprecated but still the only built-in rich-text API in every browser/WebView;
  // swap for a Selection/Range based helper if a browser drops it.
  const run = (t: Tool) => {
    ref.current?.focus();
    if (t.cmd === 'formatBlock') {
      const cur = document.queryCommandValue('formatBlock').toLowerCase();
      document.execCommand('formatBlock', false, cur === t.arg ? 'p' : t.arg);
    } else document.execCommand(t.cmd, false);
    emit();
  };

  const tools: Tool[] = [
    { cmd: 'bold', label: labels.bold, glyph: 'B' },
    { cmd: 'italic', label: labels.italic, glyph: 'I' },
    { cmd: 'underline', label: labels.underline, glyph: 'U' },
    { cmd: 'formatBlock', arg: 'h3', label: labels.heading, glyph: 'H' },
    { cmd: 'insertUnorderedList', label: labels.bullets, glyph: '•' },
    { cmd: 'insertOrderedList', label: labels.numbers, glyph: '1.' },
  ];

  const p = palette;
  return (
    <div style={{ fontFamily: '"Be Vietnam Pro", system-ui, sans-serif', color: p.fg, background: p.surface, border: `1px solid ${p.border}`, borderRadius: 12, overflow: 'hidden' }}>
      <style>{`
        .re-tool { min-width: 36px; height: 36px; border: none; border-radius: 8px; background: none; color: ${p.fg}; font: inherit; font-size: 15px; cursor: pointer; }
        .re-tool:hover { background: ${p.hover}; }
        .re-tool:focus-visible { outline: 2px solid ${p.accent}; outline-offset: 1px; }
        .re-body { min-height: 280px; padding: 14px 16px; outline: none; font-size: 16px; line-height: 1.6; }
        .re-body:empty::before { content: attr(data-placeholder); color: ${p.muted}; }
        .re-body h3 { font-size: 17px; margin: 14px 0 4px; font-weight: 600; }
        .re-body h3:first-child { margin-top: 0; }
        .re-body p { margin: 0 0 6px; }
        .re-body ul, .re-body ol { margin: 0 0 6px; padding-left: 22px; }
        .re-body blockquote { margin: 0 0 6px; padding-left: 12px; border-left: 3px solid ${p.border}; color: ${p.muted}; }
        ::selection { background: ${p.wash}; }
      `}</style>
      <div role="toolbar" style={{ display: 'flex', flexWrap: 'wrap', gap: 2, padding: 6, borderBottom: `1px solid ${p.border}` }}>
        {tools.map((t) => (
          <button
            key={t.label}
            type="button"
            className="re-tool"
            title={t.label}
            aria-label={t.label}
            // mousedown keeps the selection in the editor; click would move focus to the button first.
            onMouseDown={(e) => { e.preventDefault(); run(t); }}
            style={{ fontWeight: t.cmd === 'bold' ? 700 : 500, fontStyle: t.cmd === 'italic' ? 'italic' : 'normal', textDecoration: t.cmd === 'underline' ? 'underline' : 'none' }}
          >
            {t.glyph}
          </button>
        ))}
      </div>
      <div
        ref={ref}
        className="re-body"
        contentEditable
        // No red squiggles: reports mix Vietnamese, English and jargon the spell checker flags.
        spellCheck={false}
        autoCorrect="off"
        role="textbox"
        aria-multiline
        aria-label={labels.placeholder}
        data-placeholder={labels.placeholder}
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
