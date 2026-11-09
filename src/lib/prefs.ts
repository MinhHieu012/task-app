// Device-local settings (language, accent), web version; prefs.native.ts is the iOS/Android one.
// Read synchronously at startup so theme.ts builds every StyleSheet with the chosen accent. Styles are built once
// at module load, so a change is applied by reloading the app (restart) rather than re-rendering.

export function getPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // private mode / blocked storage: fall back to defaults
  }
}

export function setPref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

export const restart = () => window.location.reload();
