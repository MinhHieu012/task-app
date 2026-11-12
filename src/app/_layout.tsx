import {
  BeVietnamPro_400Regular,
  BeVietnamPro_500Medium,
  BeVietnamPro_600SemiBold,
  BeVietnamPro_700Bold,
} from '@expo-google-fonts/be-vietnam-pro';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { LogBox, Platform } from 'react-native';

import { Launch } from '@/components/Launch';
import { Notifier } from '@/components/Notifier';
import { color, dark, duration, easeCss, font } from '@/constants/theme';
import { getLang, setLang } from '@/lib/i18n';
import { getPref } from '@/lib/prefs';
import { useSession } from '@/lib/supabase';

// The native root view sits under every screen and showed white through gaps while scrolling/animating
// in dark mode. Theme is fixed at startup (a change reloads), so setting it once is enough.
SystemUI.setBackgroundColorAsync(color.background);

// Keep the native splash until the font and the session are in (see RootLayout). Called at module scope, not
// awaited (expo-splash-screen docs).
SplashScreen.preventAutoHideAsync();

// Dev builds only (release builds don't track promise rejections at all): Expo's DOM component wrapper (expo
// 58.0.23, still so in 58.0.24, src/dom/webview-wrapper.tsx `emit`) posts props into its WebView without catching
// the promise. When it re-renders after a size change just as the native view goes away, the post is rejected:
// harmless (nothing is left to update; a WebView that is still loading gets the props again on DOM_READY), but
// LogBox raised it as a red error over the report screen. Only this one message is silenced.
LogBox.ignoreLogs(["Call to function 'DomWebView.injectJavaScript' has been rejected"]);

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
      color-scheme: ${dark ? 'dark' : 'light'};
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

  // Tab icon in the chosen accent: the static assets/favicon.png (the default sea blue) shows until this
  // runs. Changing the accent reloads the app, so drawing it once at startup keeps it in sync.
  // Same mark as assets/mark.png (scripts drew it on a 512 grid): the back tick whole, the front tick cut by a
  // tile-coloured stroke along the back one, so the two ticks never merge.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="144" fill="${color.primary}"/><g transform="translate(97 97) scale(0.62)" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M236 330L266 360L444 150" stroke="${color.primaryFg}" stroke-width="46"/><path d="M70 270L160 360L338 150" stroke="${color.primary}" stroke-width="98"/><path d="M70 270L160 360L338 150" stroke="${color.primaryFg}" stroke-width="46"/></g></svg>`;
  document.querySelectorAll('link[rel~="icon"]').forEach((l) => l.remove());
  const icon = document.createElement('link');
  icon.rel = 'icon';
  icon.type = 'image/svg+xml';
  icon.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  document.head.appendChild(icon);
}

// Navigation paints each screen's container (and the cross-fade behind it) in its own theme, light by default.
// A screen's first visit showed that light background for a frame in dark mode; later visits reuse the
// mounted screen, so only the first flashed. Give navigation our tokens instead.
const navTheme = {
  ...(dark ? DarkTheme : DefaultTheme),
  dark,
  colors: {
    ...(dark ? DarkTheme : DefaultTheme).colors,
    background: color.background,
    card: color.surface,
    text: color.foreground,
    border: color.border,
    primary: color.primary,
    notification: color.danger,
  },
};

// Android has the font built into the app (expo-font plugin in app.json), so it is there on the first frame;
// iOS and web still load it at startup.
const FONTS = Platform.OS === 'android' ? [] : [
  {
    fontFamily: font,
    fontDefinitions: [
      { path: BeVietnamPro_400Regular, weight: 400, style: 'normal' as const },
      { path: BeVietnamPro_500Medium, weight: 500, style: 'normal' as const },
      { path: BeVietnamPro_600SemiBold, weight: 600, style: 'normal' as const },
      { path: BeVietnamPro_700Bold, weight: 700, style: 'normal' as const },
    ],
  },
];

// How long the native splash may wait for the session before <Launch> takes over.
const SPLASH_MS = 600;

export default function RootLayout() {
  const session = useSession();
  // One family, four faces: styles pick a face with fontWeight (SDK 58 fonts guide).
  const [fontsLoaded, fontError] = useFonts(FONTS);
  const fontsReady = fontsLoaded || !!fontError;
  const ready = session !== undefined;
  // The splash stays up while the stored session is read (usually a few ms), so the first screen shows
  // directly; only a slow read (a token refresh over a bad network) brings up <Launch>.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), SPLASH_MS);
    return () => clearTimeout(t);
  }, []);
  const splashDone = fontsReady && (ready || slow);
  useEffect(() => {
    if (splashDone) SplashScreen.hide();
  }, [splashDone]);
  if (!fontsReady) return null;
  return (
    <ThemeProvider value={navTheme}>
    {/* Mounted once the session is known, so the guards never flash sign-in for a signed-in user. */}
    {ready && (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
        {/* Phones: the task rises over the list as a full-height sheet (back or Huỷ closes it). Chosen over a
            formSheet with detents, whose keyboard handling around the rich-text WebView is the risky part on Android. */}
        <Stack.Screen name="task/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack.Protected>
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="design-system" />
    </Stack>
    )}
    {/* Phones only, and only when the session is slow: web has no splash and opens straight into the page. */}
    {Platform.OS !== 'web' && splashDone && <Launch ready={ready} />}
    <Notifier />
    <StatusBar style={dark ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}
