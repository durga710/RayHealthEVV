import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { __registerShiftAlarmController, type ShiftAlarmPayload } from '../../lib/shift-alarm';
import ShiftAlarmOverlay from './ShiftAlarmOverlay';

/**
 * Mount-once host for the in-app shift alarm, rendered in app/_layout.tsx as
 * a sibling after <Stack> (and before <AppAlertProvider/> so dialogs and
 * toasts still paint above the alarm). Screens never render this directly;
 * triggers call presentShiftAlarm() from src/lib/shift-alarm.ts.
 */
export default function ShiftAlarmHost() {
  const router = useRouter();
  const [payload, setPayload] = useState<ShiftAlarmPayload | null>(null);

  useEffect(() => {
    __registerShiftAlarmController({ present: (next) => setPayload(next) });
    return () => __registerShiftAlarmController(null);
  }, []);

  const dismiss = useCallback(() => setPayload(null), []);

  // Same param shape as the dashboard card press and the notification tap
  // deep link, so /clockin renders identically regardless of entry point.
  const openVisit = useCallback(() => {
    if (!payload) return;
    setPayload(null);
    router.push({
      pathname: '/clockin',
      params: {
        assignmentId: payload.assignmentId,
        clientName: payload.clientName,
        scheduledTime: payload.scheduledTime,
        serviceCode: payload.serviceCode ?? '',
        clientAddress: payload.clientAddress ?? '',
      },
    });
  }, [payload, router]);

  if (!payload) return null;
  return <ShiftAlarmOverlay payload={payload} onOpenVisit={openVisit} onDismiss={dismiss} />;
}
