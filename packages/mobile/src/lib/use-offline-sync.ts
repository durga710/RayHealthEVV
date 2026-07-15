/**
 * Mounts the offline EVV queue's replay triggers: app launch, connectivity
 * regained (NetInfo), and app returning to the foreground. Enabled only while
 * authenticated, replaying without a session would burn attempts on 401s.
 * When a replay actually drains synced punches, the caregiver gets a quiet
 * confirmation toast that their offline visits made it to the office.
 */
import { useEffect } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { offlineEvvQueue } from './offline-queue';
import { showAppToast } from '../features/common/alerts/appAlert';

export function useOfflineEvvSync(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    let disposed = false;

    const kick = () => {
      void offlineEvvQueue.replay().then((result) => {
        if (disposed) return;
        if (result.outcome === 'drained' && result.synced > 0) {
          showAppToast({
            message: `Offline visit data synced (${result.synced} update${result.synced === 1 ? '' : 's'}).`,
            variant: 'success',
            durationMs: 4000,
          });
        }
      });
    };

    void offlineEvvQueue.init().then(kick);
    const unsubscribeNet = NetInfo.addEventListener((state) => {
      if (state.isConnected) kick();
    });
    const appStateSub = AppState.addEventListener('change', (status) => {
      if (status === 'active') kick();
    });
    return () => {
      disposed = true;
      unsubscribeNet();
      appStateSub.remove();
    };
  }, [enabled]);
}
