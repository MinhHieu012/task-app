import {
  BeVietnamPro_400Regular,
  BeVietnamPro_500Medium,
  BeVietnamPro_600SemiBold,
  BeVietnamPro_700Bold,
} from '@expo-google-fonts/be-vietnam-pro';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import { Notifier } from '@/components/Notifier';
import { color, duration, easeCss, font } from '@/constants/theme';
import { getLang, setLang } from '@/lib/i18n';
import { getPref } from '@/lib/prefs';
import { useSession } from '@/lib/supabase';

// Before the first render; strings are translated as they render (see i18n.ts).
setLang(getPref('lang'));
if (Platform.OS === 'web' && typeof document !== 'undefined') document.documentElement.lang = getLang();

// Web: the page's one stylesheet. It opens with the Hallmark stamp (the design decisions, read by sloplint),
// declares the tokens at :root from theme.ts, and holds what React Native styles cannot: scrollbars, focus
// rings, transitions and reduced motion. Every Pressable renders as a focusable element ([tabindex]), so one
// rule eases all hover/press/focus colour changes instead of a transition style on each call site.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const css = document.createElement('style');
  css.textContent = `/* Hallmark · shape: app screen · genre: editorial · theme: Almanac (deal 1/3, seed personal-task-manager-daily-4a2a·e795f77a·2026-11-09·r0) · redesign: full
 * nav: kept shell (icon rail + top bar wide, bottom tabs narrow) · signature: the day's tasks as one sheet of lines · states: loading, empty, full, error (toasts)
 * axes: light/sans/chromatic-terracotta (softened by request: the slate, ink and square corners read cold) · posture: warm · contrast: pass · v2.0.0 */
/* Hallmark · pre-emit critique: P4 H4 E4 S3 R5 V4 · weakest: S, a task list reads like any task list; set the lists as a printed ledger (firm rule, hairline lines, tabular times) instead of floating cards */
/* Hallmark · dropped add, folder-outline, onPrimary · Ionicons names on the old project cards and a colour constant on sign-in, read as a field and a handler; no field or handler was removed */
/* Hallmark · waive 64/fonts: one family, Be Vietnam Pro, for every role · the theme's Hanken/Newsreader/Plex lack full Vietnamese glyphs and the owner keeps this face */
    :root {
      --color-paper: ${color.background}; --color-sheet: ${color.surface}; --color-ink: ${color.foreground};
      --color-muted: ${color.muted}; --color-rule: ${color.border}; --color-accent: ${color.primary};
      --color-focus: ${color.ringFocus}; --color-scrollbar: ${color.scrollbar};
      --font-body: "${font}", ui-sans-serif, system-ui, sans-serif;
    }
    html, body { overflow-x: clip; background: var(--color-paper); color: var(--color-ink); font-family: var(--font-body); }
    ::selection { background: var(--color-accent); color: var(--color-sheet); }
    * { scrollbar-width: thin; scrollbar-color: transparent transparent; }
    *:hover { scrollbar-color: var(--color-scrollbar) transparent; }
    [tabindex] { transition: background-color ${duration.fast}ms ${easeCss}, border-color ${duration.fast}ms ${easeCss}, box-shadow ${duration.fast}ms ${easeCss}, opacity ${duration.fast}ms ${easeCss}; }
    /* Keyboard focus ring in the accent, instant (no transition on outline). Text inputs are left out:
       Field draws the ring on its whole box, and a second outline on the bare <input> doubled it. */
    [tabindex]:not(input):not(textarea):focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
    input:focus-visible, textarea:focus-visible { outline: none; }
    [aria-disabled="true"], :disabled { cursor: not-allowed; }
    /* Chrome paints autofilled inputs light blue with !important; a never-ending transition delay keeps the
       input transparent so the field box colour (the sheet) shows through. */
    input:-webkit-autofill, input:-webkit-autofill:hover, input:-webkit-autofill:focus {
      -webkit-text-fill-color: var(--color-ink); caret-color: var(--color-ink);
      transition: background-color 0s 600000s, color 0s 600000s;
    }
    /* Reduce motion: no transitions at all; state still changes, instantly. */
    @media (prefers-reduced-motion: reduce) { [tabindex] { transition: none; } }
  `;
  document.head.appendChild(css);

  // Tab icon in the chosen accent: the static assets/favicon.png (default terracotta) shows until this
  // runs. Changing the accent reloads the app, so drawing it once at startup keeps it in sync.
  // Same mark as the rail: Ionicons checkmark-done (512 grid), stroked a little heavier to read at 16px.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="144" fill="${color.primary}"/><path transform="translate(77 77) scale(0.7)" d="M464 128L240 384l-96-96M144 384l-96-96M368 128L232 284" fill="none" stroke="${color.primaryFg}" stroke-width="48" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  document.querySelectorAll('link[rel~="icon"]').forEach((l) => l.remove());
  const icon = document.createElement('link');
  icon.rel = 'icon';
  icon.type = 'image/svg+xml';
  icon.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  document.head.appendChild(icon);
}

export default function RootLayout() {
  const session = useSession();
  // One family, four faces: styles pick a face with fontWeight (SDK 58 fonts guide).
  const [fontsLoaded, fontError] = useFonts([
    {
      fontFamily: font,
      fontDefinitions: [
        { path: BeVietnamPro_400Regular, weight: 400, style: 'normal' },
        { path: BeVietnamPro_500Medium, weight: 500, style: 'normal' },
        { path: BeVietnamPro_600SemiBold, weight: 600, style: 'normal' },
        { path: BeVietnamPro_700Bold, weight: 700, style: 'normal' },
      ],
    },
  ]);
  if (session === undefined || (!fontsLoaded && !fontError)) return null;
  return (
    <>
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="task/[id]" />
        <Stack.Screen name="report/[day]" />
      </Stack.Protected>
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="design-system" />
    </Stack>
    <Notifier />
    </>
  );
}
