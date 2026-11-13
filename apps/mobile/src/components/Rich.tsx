// The rich-text DOM components, memoised, with a placeholder while the editor's WebView loads.
//
// Memo: on native, a DOM component posts all its props into its WebView (injectJavaScript) on every render, because
// Expo compares the marshalled props by identity. Callers pass a fresh `labels`, `onChange` and `dom` each render,
// so every parent re-render (a load, a realtime refetch, a screen kept alive in the tabs) fired a post, and one
// landing while the native view was not attached threw "DomWebView.injectJavaScript has been rejected".
//
// Placeholder: the WebView shows nothing until its page has loaded (a 1.7 MB bundle from Metro took ~5.5 s per
// editor in a debug build; a release build reads it from the APK), and with matchContents it has no height until
// then, so the screen below jumped when it arrived. The editor calls onChange once on mount, which is the signal.
import { type ComponentProps, memo, useLayoutEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import RichEditor from '@/components/dom/RichEditor';
import RichView from '@/components/dom/RichView';
import { Skeleton } from '@/components/ui';
import { color, rule } from '@/constants/theme';

type EditorProps = ComponentProps<typeof RichEditor>;

// The editor keeps its own text after mount (`initial` is read once), so only the frame and the labels count;
// `onChange` is passed once and stays (Editor below forwards it to the latest handler).
const Frame = memo(RichEditor, (a: EditorProps, b: EditorProps) =>
  a.initial === b.initial && a.palette === b.palette && a.minHeight === b.minHeight && a.compact === b.compact && a.labels.placeholder === b.labels.placeholder);

export function Editor(props: EditorProps) {
  const [ready, setReady] = useState(false);
  const latest = useRef(props.onChange);
  useLayoutEffect(() => { latest.current = props.onChange; });
  // Stable for the memo above; the first call (on mount, inside the WebView) means the page is up.
  const [onChange] = useState(() => (html: string, text: string) => {
    setReady(true);
    return latest.current(html, text);
  });
  return (
    <View>
      {!ready && <Placeholder minHeight={props.minHeight ?? 280} compact={props.compact} />}
      <Frame {...props} onChange={onChange} />
    </View>
  );
}

/** The editor's frame (edge, toolbar, a few lines) while its page loads, at about the height it will take. */
function Placeholder({ minHeight, compact }: { minHeight: number; compact?: boolean }) {
  return (
    <View style={s.frame} aria-hidden>
      <View style={[s.bar, { height: compact ? 41 : 89 }]} />
      <View style={[s.body, { minHeight: Math.max(minHeight, 26) + (compact ? 20 : 28) }]}>
        <Skeleton width="70%" height={14} />
        {!compact && <Skeleton width="45%" height={14} />}
      </View>
    </View>
  );
}

export const Viewer = memo(RichView, (a, b) => a.html === b.html && a.palette === b.palette);

const s = StyleSheet.create({
  frame: { borderWidth: rule.hair, borderColor: color.fieldEdge, borderRadius: 12, backgroundColor: color.field, overflow: 'hidden' },
  bar: { backgroundColor: color.surface, borderBottomWidth: rule.hair, borderBottomColor: color.border },
  body: { padding: 16, gap: 10 },
});
