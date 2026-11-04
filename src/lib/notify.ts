import { Alert, Platform } from 'react-native';

// react-native-web's Alert.alert is a no-op, so the web uses the browser dialogs (KTD7).

export function showError(message: string, title = 'Lỗi') {
  if (Platform.OS === 'web') window.alert(`${title}: ${message}`);
  else Alert.alert(title, message);
}

/** Asks before a destructive action; resolves true when the user confirms. */
export function confirmAction(title: string, message = '', confirmText = 'Xoá'): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(message ? `${title}\n\n${message}` : title));
  return new Promise((resolve) =>
    Alert.alert(title, message || undefined, [
      { text: 'Huỷ', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmText, style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }),
  );
}
