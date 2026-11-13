// Native version of prefs.ts. expo-sqlite's kv-store has a synchronous API, which AsyncStorage lacks.
import { reloadAppAsync } from 'expo';
import Storage from 'expo-sqlite/kv-store';

export function getPref(key: string): string | null {
  try {
    return Storage.getItemSync(key);
  } catch {
    return null;
  }
}

export const setPref = (key: string, value: string) => Storage.setItemSync(key, value);

// Works in debug and release builds (unlike expo-updates' reloadAsync).
export const restart = () => reloadAppAsync('Settings changed');
