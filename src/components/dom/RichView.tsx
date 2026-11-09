'use dom';
// Read-only view of a report's HTML, cleaned again on the way in (the stored copy is never trusted as-is).
import type { DOMProps } from 'expo/dom';

import type { Palette } from './RichEditor';
import { sanitize } from './sanitize';

export default function RichView({ html, palette }: { html: string; palette: Palette; dom?: DOMProps }) {
  const p = palette;
  return (
    <div style={{ fontFamily: '"Be Vietnam Pro", system-ui, sans-serif', color: p.fg, fontSize: 15, lineHeight: 1.6 }}>
      <style>{`
        .rv h3 { font-size: 16px; margin: 12px 0 2px; font-weight: 600; }
        .rv h3:first-child { margin-top: 0; }
        .rv p { margin: 0 0 4px; }
        .rv ul, .rv ol { margin: 0 0 4px; padding-left: 22px; }
        .rv blockquote { margin: 0 0 4px; padding-left: 12px; border-left: 3px solid ${p.border}; color: ${p.muted}; }
      `}</style>
      <div className="rv" dangerouslySetInnerHTML={{ __html: sanitize(html) }} />
    </div>
  );
}
