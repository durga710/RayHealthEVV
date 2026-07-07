import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, radii, shadow } from '../tokens';
import type { AlertButton, DialogVariant, IoniconName, QueuedDialog } from './types';

const VARIANT_STYLE: Record<DialogVariant, { accent: string; accentDark: string; badgeBg: string; defaultIcon: IoniconName }> = {
  destructive: { accent: colors.danger, accentDark: colors.dangerDark, badgeBg: colors.dangerBg, defaultIcon: 'alert-circle' },
  error: { accent: colors.danger, accentDark: colors.dangerDark, badgeBg: colors.dangerBg, defaultIcon: 'alert-circle-outline' },
  success: { accent: colors.success, accentDark: '#15803d', badgeBg: colors.successBg, defaultIcon: 'checkmark' },
  confirm: { accent: colors.brandBlue, accentDark: colors.navy, badgeBg: '#eaf2fb', defaultIcon: 'help-circle-outline' },
  info: { accent: colors.brandBlue, accentDark: colors.navy, badgeBg: '#eaf2fb', defaultIcon: 'information-circle-outline' },
};

const SPARKLE_DOTS = [
  { top: -6, left: -10, color: colors.brandBlue, delay: 60 },
  { top: 2, left: 78, color: colors.amber, delay: 140 },
  { top: 68, left: -14, color: colors.success, delay: 220 },
];

function fireHaptic(variant: DialogVariant) {
  if (variant === 'success') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else if (variant === 'error' || variant === 'destructive') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  else void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export default function AppDialog({
  dialog,
  onRequestClose,
}: {
  dialog: QueuedDialog | null;
  onRequestClose: () => void;
}) {
  const [rendered, setRendered] = useState<QueuedDialog | null>(null);
  const progress = useSharedValue(0);
  const badgeBounce = useSharedValue(0);
  const closingRef = useRef(false);

  useEffect(() => {
    if (dialog) {
      closingRef.current = false;
      setRendered(dialog);
      progress.value = withSpring(1, { damping: 16, stiffness: 220 });
      badgeBounce.value = 0;
      badgeBounce.value = withDelay(60, withSequence(withTiming(1.15, { duration: 140 }), withSpring(1, { damping: 10, stiffness: 260 })));
      fireHaptic(dialog.variant);
    } else {
      // The queue emptied (close()'s exit animation already finished by the
      // time onRequestClose pops it, so progress is already 0), unmount
      // immediately. Without this, `rendered` stays stuck on the last dialog
      // and its full-screen backdrop Pressable keeps intercepting touches
      // on every screen behind it, invisibly, forever.
      setRendered(null);
    }
    // Closing is driven explicitly by close(), not by `dialog` flipping to null,
    // so a queued dialog can animate in immediately after this one animates out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog]);

  const close = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    progress.value = withTiming(0, { duration: 160 }, (finished) => {
      if (finished) runOnJS(onRequestClose)();
    });
  };

  const handleButtonPress = (button: AlertButton) => {
    button.onPress?.();
    close();
  };

  const handleBackdropPress = () => {
    if (!rendered?.cancelable) return;
    rendered.onDismiss?.();
    close();
  };

  useEffect(() => {
    if (!rendered?.cancelable) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      rendered.onDismiss?.();
      close();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rendered]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: (1 - progress.value) * 14 },
      { scale: 0.92 + progress.value * 0.08 },
    ],
  }));
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: badgeBounce.value }] }));

  if (!rendered) return null;

  const v = VARIANT_STYLE[rendered.variant];
  const isOrganic = rendered.variant === 'success';
  const cardRadiusStyle = isOrganic
    ? { borderTopLeftRadius: 26, borderTopRightRadius: 26, borderBottomLeftRadius: 22, borderBottomRightRadius: 22 }
    : { borderRadius: radii.hero };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropPress} accessibilityElementsHidden />
      </Animated.View>
      <View style={styles.center} pointerEvents="box-none">
        <Animated.View
          style={[styles.card, shadow.floating, cardRadiusStyle, cardStyle]}
          accessibilityViewIsModal
          accessibilityRole="alert"
        >
          <View style={styles.badgeWrap}>
            {isOrganic
              ? SPARKLE_DOTS.map((dot, i) => <Sparkle key={i} {...dot} active={!!rendered} />)
              : null}
            <Animated.View
              style={[
                styles.badge,
                { backgroundColor: v.badgeBg },
                isOrganic ? { transform: [{ rotate: '-3deg' }] } : null,
                badgeStyle,
              ]}
            >
              <Ionicons name={rendered.icon ?? v.defaultIcon} size={30} color={v.accent} />
            </Animated.View>
          </View>

          <Text style={styles.title}>{rendered.title}</Text>
          {rendered.message ? <Text style={styles.message}>{rendered.message}</Text> : null}

          <View style={[styles.buttonRow, rendered.buttons.length === 1 && styles.buttonRowSingle]}>
            {rendered.buttons.map((button, i) => {
              const isCancel = button.style === 'cancel';
              const isDestructive = button.style === 'destructive';
              const fillColor = isDestructive ? colors.danger : v.accent;
              return (
                <Pressable
                  key={`${button.text}-${i}`}
                  onPress={() => handleButtonPress(button)}
                  accessibilityRole="button"
                  accessibilityLabel={button.text}
                  style={({ pressed }) => [
                    styles.button,
                    isCancel
                      ? [styles.buttonGhost, { borderColor: colors.border }]
                      : { backgroundColor: fillColor },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={[styles.buttonText, isCancel ? { color: colors.textSecondary } : { color: '#fff' }]}>
                    {button.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

function Sparkle({ top, left, color, delay, active }: { top: number; left: number; color: string; delay: number; active: boolean }) {
  const anim = useSharedValue(0);
  useEffect(() => {
    if (active) {
      anim.value = 0;
      anim.value = withDelay(delay, withSpring(1, { damping: 9, stiffness: 180 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  const style = useAnimatedStyle(() => ({
    opacity: anim.value,
    transform: [{ scale: anim.value }],
  }));
  return <Animated.View style={[styles.sparkle, { top, left, backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(15,45,82,0.58)' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28 },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.cardBg,
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  badgeWrap: { marginBottom: 16 },
  badge: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  sparkle: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
  title: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, textAlign: 'center', letterSpacing: -0.2 },
  message: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 22, width: '100%' },
  buttonRowSingle: { justifyContent: 'center' },
  button: { flex: 1, height: 48, borderRadius: radii.md, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12 },
  buttonGhost: { backgroundColor: colors.cardBg, borderWidth: 1 },
  buttonText: { fontSize: 15, fontWeight: '800' },
});
