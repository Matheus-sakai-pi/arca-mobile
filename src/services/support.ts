import { Linking } from 'react-native';
import app from '../../app.json';
import { supportRequestUrl } from '@/lib/supportRequest';
import { diagnosticSnapshot, recordDiagnostic } from '@/lib/diagnostics';
export async function openSupport(includeDiagnostics = false) {
  try {
    await Linking.openURL(
      supportRequestUrl(app.expo.version, undefined, includeDiagnostics ? diagnosticSnapshot() : []),
    );
  } catch {
    recordDiagnostic('support_unavailable');
    throw new Error('support_unavailable');
  }
}
