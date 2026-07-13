import * as SecureStore from 'expo-secure-store';
import apiClient from './api-client';
import type { EvvQueueStore, OfflineEvvEvent } from './offline-evv-queue';

const secureOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

/** Device-keystore/keychain-backed storage; EVV GPS payloads never enter AsyncStorage. */
export const secureEvvQueueStore: EvvQueueStore = {
  getItemAsync: (key) => SecureStore.getItemAsync(key, secureOptions),
  setItemAsync: (key, value) => SecureStore.setItemAsync(key, value, secureOptions),
  deleteItemAsync: (key) => SecureStore.deleteItemAsync(key, secureOptions),
};

export async function sendEvvEvent(event: OfflineEvvEvent, captureMode: 'online' | 'offline') {
  if (event.type === 'clock_in') {
    return apiClient.post('/api/evv/clock-in', {
      assignmentId: event.assignmentId,
      visitId: event.visitId,
      clientEventId: event.eventId,
      occurredAt: event.occurredAt,
      captureMode,
      ...(event.serviceCode ? { serviceCode: event.serviceCode } : {}),
      location: event.location,
    });
  }
  return apiClient.post(`/api/evv/clock-out/${event.visitId}`, {
    clientEventId: event.eventId,
    occurredAt: event.occurredAt,
    captureMode,
    location: event.location,
  });
}
