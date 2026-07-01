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
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useAuth, AgencyMembership } from '../../lib/AuthContext';
import { showAppToast } from '../common/alerts/appAlert';

// Rotating accent tints so adjacent agency cards read as distinct at a glance.
const CARD_TINTS = ['#1a5fa8', '#0f766e', '#7c3aed', '#b45309', '#be185d', '#4d7c0f'];

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

export default function SelectAgencyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { intent } = useLocalSearchParams<{ intent?: string }>();
  const isSwitch = intent === 'switch';
  const { user, agencies, refreshAgencies, selectAgency } = useAuth();

  const [list, setList] = useState<AgencyMembership[]>(agencies);
  const [isRefreshing, setIsRefreshing] = useState(agencies.length === 0);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  // Always re-fetch on mount so a newly linked (or disconnected) agency shows
  // up without re-logging in; the cached list renders instantly meanwhile.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const fresh = await refreshAgencies();
        if (active && fresh.length > 0) setList(fresh);
      } catch {
        // Offline / older API — the cached list (or login payload) stands.
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
    async (agency: AgencyMembership) => {
      if (switchingTo) return;
      const alreadyActive = agency.agencyId === currentAgencyId;
      setSwitchingTo(agency.agencyId);
      try {
        await selectAgency(agency.agencyId);
        if (isSwitch && alreadyActive) {
          router.back();
          return;
        }
        if (!alreadyActive) {
          showAppToast({
            message: `Now viewing ${agency.agencyName || 'your agency'}.`,
            variant: 'success',
            icon: 'business-outline',
          });
        }
        router.replace('/(tabs)/dashboard');
      } catch {
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
    <LinearGradient colors={['#0f2d52', '#1a5fa8', '#2d7dd2']} style={styles.gradient}>
      <StatusBar style="light" />

      {/* Top bar — back affordance only when switching from Settings; a fresh
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
            <Ionicons name="chevron-back" size={24} color="#cfe2f5" />
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
          <View style={styles.loadingBlock}>
            <ActivityIndicator color="#fff" size="large" />
            <Text style={styles.loadingText}>Loading your agencies…</Text>
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
                    onPress={() => void handlePick(agency)}
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
                    <View style={[styles.cardAvatar, { backgroundColor: `${tint}1a` }]}>
                      <Text style={[styles.cardAvatarText, { color: tint }]}>
                        {agencyInitials(agency.agencyName)}
                      </Text>
                    </View>
                    <View style={styles.cardBody}>
                      <Text style={styles.cardName} numberOfLines={2}>
                        {agency.agencyName || 'Agency'}
                      </Text>
                      <View style={styles.cardMetaRow}>
                        <Ionicons name="person-outline" size={12} color="#5a7088" />
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
                      <Ionicons name="checkmark-circle" size={24} color="#16a34a" />
                    ) : (
                      <Ionicons name="chevron-forward" size={20} color="#bcccdc" />
                    )}
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        )}

        <Animated.View entering={FadeIn.delay(300)} style={styles.noteCard}>
          <Ionicons name="shield-checkmark-outline" size={18} color="#a8c8e8" style={styles.noteIcon} />
          <Text style={styles.noteText}>
            Everything you see during this session — schedules, visits, messages, and patients —
            belongs only to the agency you select.
          </Text>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  topBar: { paddingHorizontal: 12, minHeight: 44, justifyContent: 'center' },
  backBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 12 },
  backText: { color: '#cfe2f5', fontSize: 16, fontWeight: '600', marginLeft: 2 },

  scroll: { flexGrow: 1, paddingHorizontal: 20 },

  hero: { alignItems: 'center', marginTop: 8, marginBottom: 26, paddingHorizontal: 12 },
  heroIconRing: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: '#ffffff1f', borderWidth: 2, borderColor: '#ffffff40',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  heroTitle: {
    fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: -0.4,
    textShadowColor: '#00000040', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  heroSub: { fontSize: 14, color: '#a8c8e8', textAlign: 'center', marginTop: 8, lineHeight: 21 },

  loadingBlock: { alignItems: 'center', paddingVertical: 48, gap: 14 },
  loadingText: { color: '#a8c8e8', fontSize: 14, fontWeight: '600' },

  cardList: { gap: 12 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff', borderRadius: 18, padding: 16,
    borderWidth: 2, borderColor: 'transparent',
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 }, elevation: 6,
  },
  cardCurrent: { borderColor: '#16a34a55' },
  cardPressed: { transform: [{ scale: 0.98 }], backgroundColor: '#f5f9fd' },
  cardAvatar: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  cardAvatarText: { fontSize: 17, fontWeight: '900', letterSpacing: 0.5 },
  cardBody: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '800', color: '#0f2d52', lineHeight: 21 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  cardMeta: { fontSize: 12.5, color: '#5a7088', fontWeight: '600', textTransform: 'capitalize' },
  currentPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', borderWidth: 1,
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 6,
  },
  currentDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#16a34a' },
  currentPillText: { color: '#15803d', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.6 },

  noteCard: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: '#ffffff14', borderColor: '#ffffff2b', borderWidth: 1,
    borderRadius: 14, padding: 14, marginTop: 24,
  },
  noteIcon: { marginTop: 1 },
  noteText: { flex: 1, color: '#cfe2f5', fontSize: 12.5, lineHeight: 19 },
});
