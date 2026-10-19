import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import { installReferral } from '@/lib/membership';

export async function referralDevice(): Promise<string | null> {
  if (Platform.OS !== 'android') return null;
  try {
    const id = Application.getAndroidId();
    return id
      ? await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `arca-referral-v1:${id}`)
      : null;
  } catch {
    return null;
  }
}
export async function installedReferral(): Promise<string> {
  if (Platform.OS !== 'android') return '';
  try {
    return installReferral(await Application.getInstallReferrerAsync());
  } catch {
    return '';
  }
}
