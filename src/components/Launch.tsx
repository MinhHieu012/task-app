import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Logo, PreviewCard } from '@/components/AuthShell';
import { animate, ease, reducedMotion } from '@/components/ui';
import { color, dark, duration, radius, rule, text } from '@/constants/theme';
import { dayTitle, greeting, today } from '@/lib/dates';
import { tr } from '@/lib/i18n';

// Long enough to read as a screen rather than a flicker when the session comes back instantly.
const MIN_MS = 900;

/** Mobile launch screen over the app while the session loads, after the native splash (same background, so
 *  the hand-off doesn't show). Text, accent and light/dark follow Settings, which the native splash can't.
 *  Fades out once `ready` and shown for MIN_MS, then unmounts. */
export function Launch({ ready }: { ready: boolean }) {
  const { top, bottom } = useSafeAreaInsets();
  const [v] = useState(() => new Animated.Value(1));
  const [minDone, setMinDone] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinDone(true), MIN_MS);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!ready || !minDone) return;
    const a = animate(v, 0, duration.base, ease.in);
    a.start(({ finished }) => finished && setGone(true));
    return () => a.stop();
  }, [ready, minDone, v]);

  if (gone) return null;
  return (
    <Animated.View style={[s.root, { opacity: v }]} pointerEvents={ready && minDone ? 'none' : 'auto'}>
      <View style={[s.top, { top: top + 24 }]}>
        <View style={s.pill}>
          <Ionicons name="calendar-clear-outline" size={14} color={color.muted} />
          <Text style={s.pillText}>{dayTitle(today())}</Text>
        </View>
        <Text style={s.muted}>{greeting(new Date().getHours())}</Text>
      </View>

      <View style={s.body}>
        <Logo />
        <View style={s.copy}>
          <Text style={s.headline}>{tr('Biết hôm nay làm gì,')}{'\n'}{tr('nhớ hôm qua đã làm gì.')}</Text>
          <Text style={s.lead}>{tr('Một nơi cho việc cần làm và nhật ký việc đã xong.')}</Text>
        </View>
        <PreviewCard style={dark ? s.cardDark : undefined} />
      </View>

      <View style={[s.foot, { bottom: bottom + 40 }]}>
        <Progress />
        <Text style={s.muted}>{tr('Đang mở…')}</Text>
      </View>
    </Animated.View>
  );
}

const TRACK = 64, BAR = 26;

/** Indeterminate bar: a short segment sweeping across the track. Under reduce motion it pulses in place instead. */
function Progress() {
  const [v] = useState(() => new Animated.Value(0));
  const still = reducedMotion();
  useEffect(() => {
    const a = Animated.loop(still
      ? Animated.sequence([animate(v, 1, 700, ease.inOut), animate(v, 0, 700, ease.inOut)])
      : animate(v, 1, 1100, ease.inOut));
    a.start();
    return () => a.stop();
  }, [v, still]);
  const style = still
    ? { width: '40%' as const, opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }
    : { width: BAR, transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-BAR, TRACK] }) }] };
  return <View style={s.track}><Animated.View style={[s.fill, style]} /></View>;
}

const s = StyleSheet.create({
  // Light: the accent wash of the sign-in intro (and the native splash); dark: the app background.
  root: { ...StyleSheet.absoluteFill, backgroundColor: dark ? color.background : color.primaryLight, paddingHorizontal: 28, justifyContent: 'center' },
  top: { position: 'absolute', left: 28, right: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: radius.full, backgroundColor: color.surface, borderWidth: rule.hair, borderColor: color.border },
  pillText: { ...text.meta, fontWeight: '500', color: color.soft, fontVariant: ['tabular-nums'] },
  body: { gap: 36 },
  copy: { gap: 12 },
  headline: { ...text.h1, fontSize: 30, lineHeight: 38, letterSpacing: -0.9, color: color.foreground },
  lead: { ...text.body, color: color.soft },
  cardDark: { borderWidth: rule.hair, borderColor: color.border },
  foot: { position: 'absolute', left: 28, flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { width: TRACK, height: 4, borderRadius: 2, backgroundColor: color.chartBar, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: color.primary },
  muted: { ...text.meta, color: color.muted },
});
