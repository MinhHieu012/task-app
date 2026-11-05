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
import { useSession } from '@/lib/supabase';

// Web: thin scrollbars that show only while the pointer is over the scrolling area.
// Every Pressable renders as a focusable element ([tabindex]), so one rule eases all hover/press/focus
// colour and scale changes instead of a transition style on each call site. Native swaps instantly on press.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const css = document.createElement('style');
  css.textContent = `
    * { scrollbar-width: thin; scrollbar-color: transparent transparent; }
    *:hover { scrollbar-color: rgba(35,35,96,0.22) transparent; }
    [tabindex] { transition: background-color ${duration.fast}ms ${easeCss}, border-color ${duration.fast}ms ${easeCss}, box-shadow ${duration.fast}ms ${easeCss}, opacity ${duration.fast}ms ${easeCss}, transform ${duration.press}ms ${easeCss}; }
    /* Keyboard focus ring in the accent colour instead of the browser's black outline (kept for a11y). */
    [tabindex]:focus-visible { outline: 2px solid ${color.primary}; outline-offset: 2px; }
    /* Chrome paints autofilled inputs light blue with !important; a never-ending transition delay keeps the
       input transparent so the field box colour (grey, white when focused) shows through. */
    input:-webkit-autofill, input:-webkit-autofill:hover, input:-webkit-autofill:focus {
      -webkit-text-fill-color: ${color.foreground}; caret-color: ${color.foreground};
      transition: background-color 0s 600000s, color 0s 600000s;
    }
    /* Reduce motion: keep colour/opacity fades, drop the press scale (the only movement here). */
    @media (prefers-reduced-motion: reduce) { [tabindex] { transition-property: background-color, border-color, box-shadow, opacity; } }
  `;
  document.head.appendChild(css);
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
      </Stack.Protected>
      <Stack.Screen name="design-system" />
    </Stack>
    <Notifier />
    </>
  );
}
