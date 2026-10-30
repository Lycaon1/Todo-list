// Reads text messages on Android through the app's own SmsReader module (modules/sms-reader).
// iPhones don't allow apps to read Messages, and the web app can't either, so this is Android only.
import { PermissionsAndroid, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

const SmsReader = Platform.OS === 'android' ? requireOptionalNativeModule('SmsReader') : null;

export const smsSupported = !!SmsReader;

// 'granted' | 'undetermined' | 'unsupported'
export async function getSmsPermission() {
  if (!smsSupported) return 'unsupported';
  return (await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS)) ? 'granted' : 'undetermined';
}

// 'granted' | 'denied' | 'blocked' (blocked = Android won't ask again, or restricted for sideloaded apps)
export async function requestSmsPermission() {
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS);
  if (result === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
  return result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ? 'blocked' : 'denied';
}

// [{ id, address, body, date }] newest first
export function readInbox(sinceMillis, limit = 300) {
  return SmsReader.getInboxMessages(sinceMillis, limit);
}
