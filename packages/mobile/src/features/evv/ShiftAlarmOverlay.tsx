import React, { useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, gradients, radii, shadow, typography } from '../common/tokens';
import type { ShiftAlarmPayload } from '../../lib/shift-alarm';

/**
 * Full-screen soft alarm shown when a shift is about to start while the app
 * is open. The OS notification (with the bundled chime) covers sound; this
 * overlay covers the visual takeover plus a repeating haptic pulse, and
 * offers one tap into the clock-in screen.
 *
 * Purely presentational: presentation, dedup, and routing live in
 * ShiftAlarmHost / src/lib/shift-alarm.ts.
 */

/** Stop the haptic pulse after this long even if the overlay stays up. */
const HAPTIC_LOOP_MS = 30_000;
const HAPTIC_PULSE_EVERY_MS = 2_000;
/** Auto-dismiss so an ignored alarm never strands a stale overlay. */
const AUTO_DISMISS_MS = 75_000;

function formatStartTime(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

function countdownLabel(msUntilStart: number): string {
  if (msUntilStart <= 0) return 'Starting now';
  const s = Math.ceil(msUntilStart / 1000);
  if (s < 90) return `Starts in ${s}s`;
  return `Starts in ${Math.ceil(s / 60)} min`;
}

function PulseRing({ delay }: { delay: number }) {
  const anim = useSharedValue(0);
  useEffect(() => {
    anim.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }), -1, false)
    );
  }, [anim, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.45 * (1 - anim.value),
    transform: [{ scale: 1 + anim.value * 0.9 }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.ring, style]} />;
}

export default function ShiftAlarmOverlay({
  payload,
  onOpenVisit,
  onDismiss,
}: {
  payload: ShiftAlarmPayload;
  onOpenVisit: () => void;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [nowTs, setNowTs] = useState(() => Date.now());
  const bellSwing = useSharedValue(0);

  // Bell wiggle: quick swing, settle, repeat. Runs for the overlay's lifetime.
  useEffect(() => {
    bellSwing.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 90 }),
        withTiming(-1, { duration: 160 }),
        withTiming(0.6, { duration: 140 }),
        withSpring(0, { damping: 7, stiffness: 240 }),
        withDelay(1400, withTiming(0, { duration: 1 }))
      ),
      -1,
      false
    );
  }, [bellSwing]);
  const bellStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${bellSwing.value * 14}deg` }],
  }));

  // Repeating haptic pulse: a strong nudge on arrival, then a heartbeat while
  // the alarm is up. The chime itself comes from the delivered notification.
  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    const pulse = setInterval(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }, HAPTIC_PULSE_EVERY_MS);
    const stop = setTimeout(() => clearInterval(pulse), HAPTIC_LOOP_MS);
    return () => {
      clearInterval(pulse);
      clearTimeout(stop);
    };
  }, []);

  // Live countdown readout.
  useEffect(() => {
    const handle = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(handle);
  }, []);

  useEffect(() => {
    const handle = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(handle);
  }, [onDismiss]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onDismiss();
      return true;
    });
    return () => sub.remove();
  }, [onDismiss]);

  const shiftStart = new Date(payload.scheduledTime).getTime();
  const countdown = Number.isFinite(shiftStart) ? countdownLabel(shiftStart - nowTs) : '';
  const startTime = formatStartTime(payload.scheduledTime);

  return (
    <Animated.View
      style={StyleSheet.absoluteFill}
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(180)}
      accessibilityViewIsModal
      accessibilityRole="alert"
    >
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
      <View style={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.top}>
          <Animated.View entering={FadeInDown.delay(80).duration(360)} style={styles.bellWrap}>
            <PulseRing delay={0} />
            <PulseRing delay={730} />
            <PulseRing delay={1460} />
            <View style={styles.bellBadge}>
              <Animated.View style={bellStyle}>
                <Ionicons name="alarm-outline" size={46} color={colors.onGradient} />
              </Animated.View>
            </View>
          </Animated.View>

          <Animated.Text entering={FadeInDown.delay(160).duration(360)} style={styles.kicker}>
            Shift starting soon
          </Animated.Text>
          <Animated.Text
            entering={FadeInDown.delay(220).duration(360)}
            style={styles.clientName}
            numberOfLines={2}
          >
            {payload.clientName}
          </Animated.Text>

          {countdown ? (
            <Animated.Text entering={FadeInDown.delay(280).duration(360)} style={styles.countdown}>
              {countdown}
            </Animated.Text>
          ) : null}

          <Animated.View entering={FadeInDown.delay(340).duration(360)} style={styles.metaCard}>
            {startTime ? (
              <View style={styles.metaRow}>
                <Ionicons name="time-outline" size={17} color={colors.onGradientSoft} />
                <Text style={styles.metaText}>Scheduled for {startTime}</Text>
              </View>
            ) : null}
            {payload.clientAddress ? (
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={17} color={colors.onGradientSoft} />
                <Text style={styles.metaText} numberOfLines={2}>
                  {payload.clientAddress}
                </Text>
              </View>
            ) : null}
            {payload.serviceCode ? (
              <View style={styles.metaRow}>
                <Ionicons name="medkit-outline" size={17} color={colors.onGradientSoft} />
                <Text style={styles.metaText}>{payload.serviceCode}</Text>
              </View>
            ) : null}
          </Animated.View>
        </View>

        <Animated.View entering={FadeInDown.delay(420).duration(360)} style={styles.actions}>
          <Pressable
            onPress={onOpenVisit}
            accessibilityRole="button"
            accessibilityLabel={`Open clock-in for ${payload.clientName}`}
            style={({ pressed }) => [styles.primaryBtn, shadow.raised, pressed && styles.pressed]}
          >
            <Text style={styles.primaryBtnText}>Go to clock-in</Text>
            <Ionicons name="arrow-forward" size={19} color={colors.brandBlue} />
          </Pressable>
          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Dismiss shift alarm"
            style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
          >
            <Text style={styles.ghostBtnText}>Dismiss</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
  },
  top: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bellWrap: {
    width: 108,
    height: 108,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 26,
  },
  ring: {
    position: 'absolute',
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 2,
    borderColor: colors.onGradient,
  },
  bellBadge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    ...typography.label,
    color: colors.onGradientSoft,
    marginBottom: 10,
  },
  clientName: {
    ...typography.hero,
    fontSize: 30,
    color: colors.onGradient,
    textAlign: 'center',
  },
  countdown: {
    marginTop: 10,
    fontSize: 17,
    fontWeight: '800',
    color: colors.onGradientSoft,
  },
  metaCard: {
    marginTop: 26,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: radii.lg,
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 10,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metaText: { ...typography.body, color: colors.onGradient, flexShrink: 1 },
  actions: { gap: 12 },
  primaryBtn: {
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.cardBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: { fontSize: 17, fontWeight: '900', color: colors.brandBlue },
  ghostBtn: {
    height: 52,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnText: { fontSize: 15, fontWeight: '800', color: colors.onGradient },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
