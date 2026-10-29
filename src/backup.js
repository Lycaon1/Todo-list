// Android / iOS app version: writes the backup to a temporary file and opens the
// share sheet so it can be saved to Files, Google Drive, email, etc.
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function saveBackupFile(filename, text) {
  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  await file.write(text);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save backup', UTI: 'public.json' });
  return 'saved';
}

// Resolves with the file's text, or null if nothing was chosen
export async function pickBackupFile() {
  const picked = await File.pickFileAsync({ mimeTypes: '*/*' });
  if (picked.canceled) return null;
  return picked.result.text();
}
