import { Stack } from 'expo-router';

import { useSession } from '@/lib/supabase';

export default function RootLayout() {
  const session = useSession();
  if (session === undefined) return null;
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
