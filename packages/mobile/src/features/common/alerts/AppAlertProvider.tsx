import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { __registerAppAlertController } from './appAlert';
import AppDialog from './AppDialog';
import AppToast from './AppToast';
import type { QueuedDialog, QueuedToast } from './types';

/**
 * Self-contained host for the branded alert/toast system, no context is
 * needed since screens call the imperative showAppAlert/showAppToast
 * functions directly, not a hook. Mount once, as a sibling rendered after
 * <Stack> so it always paints on top (see app/_layout.tsx).
 */
export default function AppAlertProvider() {
  const [dialogQueue, setDialogQueue] = useState<QueuedDialog[]>([]);
  const [toastQueue, setToastQueue] = useState<QueuedToast[]>([]);

  const pushDialog = useCallback((dialog: QueuedDialog) => {
    setDialogQueue((q) => [...q, dialog]);
  }, []);
  const pushToast = useCallback((toast: QueuedToast) => {
    setToastQueue((q) => [...q, toast]);
  }, []);

  useEffect(() => {
    __registerAppAlertController({ pushDialog, pushToast });
    return () => __registerAppAlertController(null);
  }, [pushDialog, pushToast]);

  const dismissDialog = useCallback(() => setDialogQueue((q) => q.slice(1)), []);
  const dismissToast = useCallback(() => setToastQueue((q) => q.slice(1)), []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <AppDialog dialog={dialogQueue[0] ?? null} onRequestClose={dismissDialog} />
      <AppToast toast={toastQueue[0] ?? null} onDismiss={dismissToast} />
    </View>
  );
}
