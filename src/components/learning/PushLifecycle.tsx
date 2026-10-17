import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { bindPushAccount, observePush } from '@/services/pushNotifications';
export function PushLifecycle() {
  const { session, loading, isRecovery, isGuest } = useAuth();
  const owner = session?.user.id ?? null;
  useEffect(() => { if (!loading) return bindPushAccount(isRecovery ? null : owner); }, [owner, loading, isRecovery]);
  useEffect(() => {
    if (loading || isRecovery || (!owner && !isGuest)) return;
    return observePush(owner ?? 'guest', target => router.navigate(target));
  }, [owner, isGuest, loading, isRecovery]);
  return null;
}
