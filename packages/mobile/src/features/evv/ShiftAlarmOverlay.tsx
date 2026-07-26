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
import { colors, gradients, radii, typography } from '../common/tokens';
import type { ShiftAlarmPayload } from '../../lib/shift-alarm';

/**
 * Full-screen soft alarm shown when a shift is about to start while the app
 * is open. Styled as a blown-up NextVisitHero card (DashboardScreen): the
 * same diagonal hero gradient, eyebrow + timing corners, client line, icon
 * meta row, and frosted CTA, so the takeover reads as "the Up next card,
 * urgently". The OS notification covers sound; this overlay covers the
 * visual takeover plus a repeating haptic pulse, and offers one tap into
 * the clock-in screen.
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

/** Same spirit as the hero's countdown: compact, tabular-friendly. */
function countdownValue(msUntilStart: number): string {
  if (msUntilStart <= 0) return 'Now';
  const s = Math.ceil(msUntilStart / 1000);
  if (s < 90) return `${s}s`;
  return `${Math.ceil(s / 60)} min`;
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

/** The hero's live-dot, pulsing: this shift needs attention right now. */
function AlarmDot() {
  const anim = useSharedValue(0);
  useEffect(() => {
    anim.value = withRepeat(
      withSequence(withTiming(1, { duration: 600 }), withTiming(0, { duration: 600 })),
      -1,
      false
    );
  }, [anim]);
  const style = useAnimatedStyle(() => ({ opacity: 0.35 + anim.value * 0.65 }));
  return <Animated.View style={[styles.eyebrowDot, style]} />;
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
  const hasTime = Number.isFinite(shiftStart);
  const timingLabel = hasTime && shiftStart <= nowTs ? 'STARTS' : 'STARTS IN';
  const timingValue = hasTime ? countdownValue(shiftStart - nowTs) : '';
  const startTime = formatStartTime(payload.scheduledTime);

  return (
    <Animated.View
      style={StyleSheet.absoluteFill}
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(180)}
      accessibilityViewIsModal
      accessibilityRole="alert"
    >
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 20 }]}>
        <Animated.View entering={FadeInDown.duration(320)} style={styles.topRow}>
          <View style={styles.eyebrowWrap}>
            <AlarmDot />
            <Text style={styles.eyebrow}>SHIFT STARTING SOON</Text>
          </View>
          {timingValue ? (
            <View style={styles.timing}>
              <Text style={styles.timingLabel}>{timingLabel}</Text>
              <Text style={styles.timingValue}>{timingValue}</Text>
            </View>
          ) : null}
        </Animated.View>

        <View style={styles.center}>
          <Animated.View entering={FadeInDown.delay(80).duration(360)} style={styles.bellWrap}>
            <PulseRing delay={0} />
            <PulseRing delay={730} />
            <PulseRing delay={1460} />
            <View style={styles.bellBadge}>
              <Animated.View style={bellStyle}>
                <Ionicons name="alarm-outline" size={44} color={colors.onGradient} />
              </Animated.View>
            </View>
          </Animated.View>

          <Animated.Text
            entering={FadeInDown.delay(180).duration(360)}
            style={styles.clientName}
            numberOfLines={2}
          >
            {payload.clientName}
          </Animated.Text>

          <Animated.View entering={FadeInDown.delay(240).duration(360)} style={styles.metaRow}>
            {startTime ? (
              <>
                <Ionicons name="time-outline" size={13} color={colors.onGradientSoft} />
                <Text style={styles.meta}>{startTime}</Text>
              </>
            ) : null}
            {startTime && payload.clientAddress ? <Text style={styles.metaDivider}>·</Text> : null}
            {payload.clientAddress ? (
              <>
                <Ionicons name="location-outline" size={13} color={colors.onGradientSoft} />
                <Text style={styles.meta} numberOfLines={1}>
                  {payload.clientAddress}
                </Text>
              </>
            ) : null}
          </Animated.View>

          {payload.serviceCode ? (
            <Animated.View entering={FadeInDown.delay(300).duration(360)} style={styles.servicePanel}>
              <View style={styles.servicePanelIcon}>
                <Ionicons name="medkit-outline" size={18} color={colors.onGradientSoft} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.servicePanelTitle}>Service</Text>
                <Text style={styles.servicePanelSub}>{payload.serviceCode}</Text>
              </View>
            </Animated.View>
          ) : null}
        </View>

        <Animated.View entering={FadeInDown.delay(380).duration(360)} style={styles.actions}>
          <Pressable
            onPress={onOpenVisit}
            accessibilityRole="button"
            accessibilityLabel={`Open clock-in for ${payload.clientName}`}
            style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
          >
            <Ionicons name="location" size={18} color={colors.onGradient} />
            <Text style={styles.ctaText}>Tap to clock in</Text>
            <Ionicons name="arrow-forward" size={17} color={colors.onGradient} />
          </Pressable>
          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Dismiss shift alarm"
            style={({ pressed }) => [styles.dismissBtn, pressed && styles.pressed]}
          >
            <Text style={styles.dismissText}>Dismiss</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

// Frosted surfaces, eyebrow, timing block, meta row, and CTA mirror the
// NextVisitHero styles in DashboardScreen so the two read as one component
// family. If the hero's look changes, change this to match.
const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  eyebrowWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  eyebrowDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.onGradient },
  eyebrow: { ...typography.label, fontSize: 11, letterSpacing: 1, color: colors.onGradientSoft },
  timing: { alignItems: 'flex-end' },
  timingLabel: { ...typography.caption, fontSize: 9, letterSpacing: 0.8, color: colors.onGradientSoft },
  timingValue: {
    color: colors.onGradient,
    fontSize: 26,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    marginTop: 1,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bellWrap: {
    width: 104,
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  ring: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 2,
    borderColor: colors.onGradient,
  },
  bellBadge: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: '#ffffff14',
    borderWidth: 1,
    borderColor: '#ffffff20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientName: {
    ...typography.hero,
    fontSize: 28,
    color: colors.onGradient,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
    maxWidth: '92%',
  },
  meta: { ...typography.sub, color: colors.onGradientSoft, flexShrink: 1 },
  metaDivider: { color: colors.onGradientSoft, marginHorizontal: 2 },
  servicePanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff14',
    borderRadius: radii.md,
    padding: 12,
    marginTop: 18,
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: '#ffffff20',
  },
  servicePanelIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.sm,
    backgroundColor: '#ffffff1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  servicePanelTitle: { ...typography.caption, fontWeight: '800', color: colors.onGradient },
  servicePanelSub: { ...typography.caption, color: colors.onGradientSoft, marginTop: 2 },
  actions: { gap: 10 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ffffff26',
    borderRadius: radii.md,
    height: 50,
    borderWidth: 1,
    borderColor: '#ffffff33',
  },
  ctaText: { color: colors.onGradient, fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  dismissBtn: { height: 44, alignItems: 'center', justifyContent: 'center' },
  dismissText: { ...typography.sub, fontWeight: '800', color: colors.onGradientSoft },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
