import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, {
  FadeInDown,
  FadeIn,
  withSpring,
  withTiming,
  EntryExitAnimationFunction,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAuth, AgencyMembership } from '../../lib/AuthContext';
import { showAppToast } from '../common/alerts/appAlert';
import { SkeletonCard } from '../common/Skeleton';
import { colors, typography, radii, shadow, gradients, alpha } from '../common/tokens';

// Rotating accent tints so adjacent agency cards read as distinct at a glance.
const CARD_TINTS = [colors.brandBlue, colors.teal, colors.purple, colors.amber, '#be185d', '#4d7c0f'];

function agencyInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  return words
    .filter((w) => !/^(llc|inc|co|corp|ltd)\.?$/i.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || words[0][0].toUpperCase();
}

// Gentle spring pop (scale 0.8 → 1) for the handoff overlay's avatar and
// success check, softer than ZoomIn's full 0 → 1 blowup.
const SpringPopIn: EntryExitAnimationFunction = () => {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0.8 }] },
    animations: {
      opacity: withTiming(1, { duration: 180 }),
      transform: [{ scale: withSpring(1, { damping: 14, stiffness: 180 }) }],
    },
  };
};

export default function SelectAgencyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { intent } = useLocalSearchParams<{ intent?: string }>();
  const isSwitch = intent === 'switch';
  const { user, agencies, refreshAgencies, selectAgency } = useAuth();

  const [list, setList] = useState<AgencyMembership[]>(agencies);
  const [isRefreshing, setIsRefreshing] = useState(agencies.length === 0);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  // Full-screen "workspace handoff" overlay shown while the switch is in
  // flight; `done` flips it to the success beat before we navigate away.
  const [handoff, setHandoff] = useState<
    { agency: AgencyMembership; tint: string; done: boolean } | null
  >(null);

  // Always re-fetch on mount so a newly linked (or disconnected) agency shows
  // up without re-logging in; the cached list renders instantly meanwhile.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const fresh = await refreshAgencies();
        if (active && fresh.length > 0) setList(fresh);
      } catch {
        // Offline / older API, the cached list (or login payload) stands.
      } finally {
        if (active) setIsRefreshing(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [refreshAgencies]);

  useEffect(() => {
    if (agencies.length > 0) setList(agencies);
  }, [agencies]);

  const currentAgencyId = user?.agencyId;
  const sorted = useMemo(
    () => [...list].sort((a, b) => a.agencyName.localeCompare(b.agencyName)),
    [list],
  );

  const handlePick = useCallback(
    async (agency: AgencyMembership, tint: string) => {
      if (switchingTo) return;
      void Haptics.selectionAsync();
      const alreadyActive = agency.agencyId === currentAgencyId;
      // Re-picking the current agency from Settings just pops back, no
      // handoff moment for a no-op.
      const showHandoff = !(isSwitch && alreadyActive);
      setSwitchingTo(agency.agencyId);
      if (showHandoff) setHandoff({ agency, tint, done: false });
      try {
        await selectAgency(agency.agencyId);
        if (isSwitch && alreadyActive) {
          router.back();
          return;
        }
        setHandoff((h) => (h ? { ...h, done: true } : h));
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await new Promise<void>((resolve) => setTimeout(resolve, 500));
        router.replace('/(tabs)/dashboard');
      } catch {
        setHandoff(null);
        showAppToast({
          message: "Couldn't switch agencies. Check your connection and try again.",
          variant: 'warning',
          icon: 'alert-circle-outline',
        });
        setSwitchingTo(null);
      }
    },
    [currentAgencyId, isSwitch, router, selectAgency, switchingTo],
  );

  return (
    <LinearGradient colors={gradients.hero} style={styles.gradient}>
      <StatusBar style="light" />

      {/* Top bar, back affordance only when switching from Settings; a fresh
          sign-in must pick an agency, there is nothing to go back to. */}
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        {isSwitch ? (
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={24} color={colors.onGradientSoft} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(400)} style={styles.hero}>
          <View style={styles.heroIconRing}>
            <Ionicons name="business" size={34} color="#fff" />
          </View>
          <Text style={styles.heroTitle}>{isSwitch ? 'Switch Agency' : 'Select Your Agency'}</Text>
          <Text style={styles.heroSub}>
            {isSwitch
              ? 'Choose which agency to work in. Your schedule, messages, and patients will update to match.'
              : `Your RayHealthEVV ID is linked to ${sorted.length || 'multiple'} agencies. Pick the one you're working for right now.`}
          </Text>
        </Animated.View>

        {isRefreshing && sorted.length === 0 ? (
          <View style={styles.cardList}>
            {[0, 1, 2].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </View>
        ) : (
          <View style={styles.cardList}>
            {sorted.map((agency, index) => {
              const tint = CARD_TINTS[index % CARD_TINTS.length];
              const isCurrent = agency.agencyId === currentAgencyId;
              const isBusy = switchingTo === agency.agencyId;
              return (
                <Animated.View
                  key={agency.agencyId}
                  entering={FadeInDown.delay(80 + index * 70).springify().damping(16)}
                >
                  <Pressable
                    onPress={() => void handlePick(agency, tint)}
                    disabled={switchingTo !== null}
                    style={({ pressed }) => [
                      styles.card,
                      isCurrent && styles.cardCurrent,
                      pressed && styles.cardPressed,
                      switchingTo !== null && !isBusy && { opacity: 0.55 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${agency.agencyName}`}
                  >
                    <View style={[styles.cardAvatar, { backgroundColor: `${tint}${alpha.tint}` }]}>
                      <Text style={[styles.cardAvatarText, { color: tint }]}>
                        {agencyInitials(agency.agencyName)}
                      </Text>
                    </View>
                    <View style={styles.cardBody}>
                      <Text style={styles.cardName} numberOfLines={2}>
                        {agency.agencyName || 'Agency'}
                      </Text>
                      <View style={styles.cardMetaRow}>
                        <Ionicons name="person-outline" size={12} color={colors.textSecondary} />
                        <Text style={styles.cardMeta}>
                          {agency.role === 'caregiver' ? 'Caregiver' : agency.role}
                        </Text>
                        {isCurrent ? (
                          <View style={styles.currentPill}>
                            <View style={styles.currentDot} />
                            <Text style={styles.currentPillText}>CURRENT</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    {isBusy ? (
                      <ActivityIndicator color={tint} />
                    ) : isCurrent ? (
                      <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                    ) : (
                      <Ionicons name="chevron-forward" size={20} color={colors.chevron} />
                    )}
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        )}

        <Animated.View entering={FadeIn.delay(300)} style={styles.noteCard}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.onGradientSoft} style={styles.noteIcon} />
          <Text style={styles.noteText}>
            Everything you see during this session, schedules, visits, messages, and patients , 
            belongs only to the agency you select.
          </Text>
        </Animated.View>
      </ScrollView>

      {/* Workspace handoff, a deliberate full-screen beat while the switch
          lands, replacing a toast that used to clip against the nav
          transition. Unmounting on error handles the fade-out. */}
      {handoff ? (
        <Animated.View
          entering={FadeIn.duration(220)}
          style={styles.handoffOverlay}
          accessibilityLiveRegion="polite"
        >
          <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
          <Animated.View entering={SpringPopIn} style={[styles.handoffAvatar, { backgroundColor: handoff.tint }]}>
            <Text style={styles.handoffAvatarText}>{agencyInitials(handoff.agency.agencyName)}</Text>
          </Animated.View>
          <Text style={styles.handoffName} numberOfLines={2}>
            {handoff.agency.agencyName || 'Agency'}
          </Text>
          {handoff.done ? (
            <Animated.View entering={SpringPopIn} style={styles.handoffStatusRow}>
              <View style={styles.handoffCheck}>
                <Ionicons name="checkmark" size={18} color={colors.onGradient} />
              </View>
              <Text style={styles.handoffStatusDone}>{"You're all set"}</Text>
            </Animated.View>
          ) : (
            <View style={styles.handoffStatusRow}>
              <ActivityIndicator size="small" color={colors.onGradientSoft} />
              <Text style={styles.handoffStatusText}>Switching workspace…</Text>
            </View>
          )}
        </Animated.View>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  topBar: { paddingHorizontal: 12, minHeight: 44, justifyContent: 'center' },
  backBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 12 },
  backText: { color: colors.onGradientSoft, fontSize: 16, fontWeight: '600', marginLeft: 2 },

  scroll: { flexGrow: 1, paddingHorizontal: 20 },

  hero: { alignItems: 'center', marginTop: 8, marginBottom: 26, paddingHorizontal: 12 },
  heroIconRing: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: '#ffffff1f', borderWidth: 2, borderColor: '#ffffff40',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  heroTitle: {
    ...typography.hero, color: '#fff',
    textShadowColor: '#00000040', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  heroSub: { ...typography.sub, color: colors.onGradientSoft, textAlign: 'center', marginTop: 8, lineHeight: 20 },

  cardList: { gap: 12 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.cardBg, borderRadius: radii.lg, padding: 16,
    borderWidth: 2, borderColor: 'transparent',
    ...shadow.raised,
  },
  cardCurrent: { borderColor: `${colors.success}55` },
  cardPressed: { transform: [{ scale: 0.98 }], backgroundColor: colors.pressedBg },
  cardAvatar: {
    width: 48, height: 48, borderRadius: radii.md,
    justifyContent: 'center', alignItems: 'center',
  },
  cardAvatarText: { fontSize: 17, fontWeight: '900', letterSpacing: 0.5 },
  cardBody: { flex: 1 },
  cardName: { ...typography.heading, color: colors.textPrimary, lineHeight: 21 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  cardMeta: { ...typography.sub, color: colors.textSecondary, fontWeight: '600', textTransform: 'capitalize' },
  currentPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.successBg, borderColor: colors.successBorder, borderWidth: 1,
    borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 6,
  },
  currentDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  currentPillText: { color: colors.successDark, fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },

  noteCard: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: '#ffffff14', borderColor: '#ffffff2b', borderWidth: 1,
    borderRadius: radii.md, padding: 14, marginTop: 24,
  },
  noteIcon: { marginTop: 1 },
  noteText: { flex: 1, ...typography.sub, color: colors.onGradientSoft, lineHeight: 19 },

  handoffOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    elevation: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  handoffAvatar: {
    width: 76, height: 76, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
    ...shadow.floating,
  },
  handoffAvatarText: { fontSize: 26, fontWeight: '900', letterSpacing: 0.5, color: colors.onGradient },
  handoffName: {
    ...typography.hero, fontSize: 22,
    color: colors.onGradient, textAlign: 'center', paddingHorizontal: 32,
  },
  handoffStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20, minHeight: 28 },
  handoffStatusText: { ...typography.body, color: colors.onGradientSoft },
  handoffStatusDone: { ...typography.body, color: colors.onGradient },
  handoffCheck: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.success,
    justifyContent: 'center', alignItems: 'center',
  },
});
