/**
 * App wiring for the offline EVV punch queue: AsyncStorage persistence +
 * the authenticated apiClient as poster. The queue holds punch GPS fixes and
 * (for clock-outs) task/note documentation until they sync; the device's
 * at-rest encryption (iOS Data Protection / Android FBE) covers the store.
 * Replay triggers live in use-offline-sync.ts.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from './api-client';
import { OfflineEvvQueue, type PersistedQueueState, type QueueStorage } from './offline-queue-core';

const STORAGE_KEY = 'rayhealth.evv-offline-queue.v1';

const storage: QueueStorage = {
  async load(): Promise<PersistedQueueState | null> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PersistedQueueState;
    } catch {
      return null;
    }
  },
  async save(state: PersistedQueueState): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  },
};

export const offlineEvvQueue = new OfflineEvvQueue(storage, {
  post: (path, body) => apiClient.post(path, body),
});

export { isLocalVisitId } from './offline-queue-core';
