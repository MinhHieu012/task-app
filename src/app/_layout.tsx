import {
  BeVietnamPro_400Regular,
  BeVietnamPro_500Medium,
  BeVietnamPro_600SemiBold,
  BeVietnamPro_700Bold,
} from '@expo-google-fonts/be-vietnam-pro';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import { font } from '@/constants/theme';
import { useSession } from '@/lib/supabase';

// Web: thin scrollbars that show only while the pointer is over the scrolling area.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const css = document.createElement('style');
  css.textContent = `
    * { scrollbar-width: thin; scrollbar-color: transparent transparent; }
    *:hover { scrollbar-color: rgba(35,35,96,0.22) transparent; }
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
  );
}
