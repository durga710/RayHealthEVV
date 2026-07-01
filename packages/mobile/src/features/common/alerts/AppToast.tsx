import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, radii, shadow } from '../tokens';
import type { IoniconName, QueuedToast, ToastVariant } from './types';

const VARIANT_STYLE: Record<ToastVariant, { bg: string; iconColor: string; defaultIcon: IoniconName }> = {
  success: { bg: colors.navy, iconColor: '#7fe0a8', defaultIcon: 'checkmark-circle' },
  info: { bg: colors.navy, iconColor: '#9dc7ef', defaultIcon: 'information-circle' },
  warning: { bg: '#7a4a12', iconColor: '#fbbf24', defaultIcon: 'warning' },
};

export default function AppToast({ toast, onDismiss }: { toast: QueuedToast | null; onDismiss: () => void }) {
  const insets = useSafeAreaInsets();
  const [rendered, setRendered] = useState<QueuedToast | null>(null);
  const progress = useSharedValue(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingRef = useRef(false);

  useEffect(() => {
    if (toast) {
      closingRef.current = false;
      setRendered(toast);
      progress.value = withTiming(1, { duration: 220 });
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => close(), toast.durationMs);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  const close = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    progress.value = withTiming(0, { duration: 180 }, (finished) => {
      if (finished) runOnJS(onDismiss)();
    });
  };

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 16 }],
  }));

  if (!rendered) return null;
  const v = VARIANT_STYLE[rendered.variant];

  return (
    <View style={[styles.wrap, { bottom: insets.bottom + 20 }]} pointerEvents="box-none">
      <Animated.View style={style}>
        <Pressable
          onPress={close}
          accessibilityRole="alert"
          accessibilityLabel={rendered.message}
          style={({ pressed }) => [styles.toast, shadow.subtle, { backgroundColor: v.bg }, pressed && { opacity: 0.9 }]}
        >
          <Ionicons name={rendered.icon ?? v.defaultIcon} size={18} color={v.iconColor} />
          <Text style={styles.text} numberOfLines={3}>{rendered.message}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: 16 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    maxWidth: 480,
    borderRadius: radii.md,
    paddingHorizontal: 16,
    paddingVertical: 13,
    minHeight: 48,
  },
  text: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '700' },
});
