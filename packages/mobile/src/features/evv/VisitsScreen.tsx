import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFocusEffect, useRouter } from 'expo-router';
import apiClient from '../../lib/api-client';
import ErrorRetry from '../common/ErrorRetry';
import EmptyState from '../common/EmptyState';
import { SkeletonList } from '../common/Skeleton';
import { colors, typography, radii, shadow, gradients, alpha } from '../common/tokens';

type VisitStatus = 'pending' | 'verified' | 'flagged';

interface EvvVisit {
  id: string;
  clientId?: string;
  serviceCode?: string;
  clockInTime: string;
  clockOutTime?: string;
  status: VisitStatus;
  flagReason?: string | null;
}

interface CaregiverAssignmentRow {
  clientId: string;
  clientName: string;
}

// Conservative HCPCS → label map for the codes this platform supports; falls
// back to the raw code when unknown.
const SERVICE_LABELS: Record<string, string> = {
  T1019: 'Personal Care',
  S5125: 'Attendant Care',
  T1004: 'Home Health Aide',
  T1021: 'Home Health Aide Visit',
};

type Filter = 'all' | 'verified' | 'flagged';

function durationMs(v: EvvVisit): number | null {
  if (!v.clockOutTime) return null;
  const ms = new Date(v.clockOutTime).getTime() - new Date(v.clockInTime).getTime();
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

function formatHm(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
    : ', ';
}

function formatTime(iso: string | undefined): string {
  if (!iso) return ', ';
  const d = new Date(iso);
  return Number.isFinite(d.getTime())
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
    : ', ';
}

function startOfWeek(): number {
  // Local week starting Sunday. We only need a stable 7-day-ish boundary for the
  // "this week" rollup, so derive it from the current date components.
  const now = new Date();
  const day = now.getDay();
  const sun = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
  return sun.getTime();
}

export default function VisitsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [visits, setVisits] = useState<EvvVisit[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [visitsRes, assignmentsRes] = await Promise.allSettled([
        apiClient.get<EvvVisit[]>('/api/evv/visits'),
        apiClient.get<CaregiverAssignmentRow[]>('/api/assignments/caregiver'),
      ]);
      // The visits call is the one that matters; a failed name-map is tolerable.
      setError(visitsRes.status === 'fulfilled' ? null : 'Could not load your visits.');
      if (visitsRes.status === 'fulfilled') {
        const sorted = [...visitsRes.value.data].sort(
          (a, b) => new Date(b.clockInTime).getTime() - new Date(a.clockInTime).getTime(),
        );
        setVisits(sorted);
      }
      if (assignmentsRes.status === 'fulfilled') {
        const map: Record<string, string> = {};
        for (const row of assignmentsRes.value.data) {
          if (row.clientId && row.clientName) map[row.clientId] = row.clientName;
        }
        setNames(map);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refetch whenever the tab regains focus so data created in the web app
  // (new visits, status changes) shows without a manual pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const { weekMs, allMs, completedCount } = useMemo(() => {
    const weekStart = startOfWeek();
    let weekMs = 0;
    let allMs = 0;
    let completedCount = 0;
    for (const v of visits) {
      const ms = durationMs(v);
      if (ms == null) continue;
      completedCount += 1;
      allMs += ms;
      if (new Date(v.clockInTime).getTime() >= weekStart) weekMs += ms;
    }
    return { weekMs, allMs, completedCount };
  }, [visits]);

  const filtered = useMemo(() => {
    if (filter === 'all') return visits;
    return visits.filter((v) => v.status === filter);
  }, [visits, filter]);

  const renderItem = ({ item, index }: { item: EvvVisit; index: number }) => {
    const ms = durationMs(item);
    const inProgress = !item.clockOutTime;
    const statusColor =
      item.status === 'verified' ? colors.success : item.status === 'flagged' ? colors.amber : colors.slate;
    const statusLabel = inProgress
      ? 'In progress'
      : item.status === 'verified'
      ? 'Verified'
      : item.status === 'flagged'
      ? 'Flagged'
      : 'Pending';
    const service = item.serviceCode ? SERVICE_LABELS[item.serviceCode] ?? item.serviceCode : 'Visit';
    const client = item.clientId ? names[item.clientId] : undefined;

    return (
      <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 60).duration(300)}>
      <Pressable
        onPress={() =>
          router.push({
            pathname: '/visit-detail',
            params: {
              clientName: client ?? 'Client',
              clockInTime: item.clockInTime,
              ...(item.clockOutTime ? { clockOutTime: item.clockOutTime } : {}),
              status: item.status,
              ...(item.serviceCode ? { serviceCode: item.serviceCode } : {}),
              ...(item.flagReason ? { flagReason: item.flagReason } : {}),
            },
          })
        }
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
      >
        <View style={styles.cardTop}>
          <Text style={styles.cardDay}>{formatDay(item.clockInTime)}</Text>
          <View style={[styles.statusPill, { backgroundColor: `${statusColor}${alpha.tint}` }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>
        {client ? <Text style={styles.cardClient} numberOfLines={1}>{client}</Text> : null}
        <View style={styles.cardMetaRow}>
          <Text style={styles.cardTime}>
            {formatTime(item.clockInTime)}, {inProgress ? 'now' : formatTime(item.clockOutTime)}
          </Text>
          <Text style={styles.cardDuration}>{ms != null ? formatHm(ms) : ', '}</Text>
        </View>
        <Text style={styles.cardService}>{service}</Text>
        {item.status === 'flagged' ? (
          <View style={styles.flagRow}>
            <Ionicons name="alert-circle" size={14} color={colors.amber} />
            <Text style={styles.flagText} numberOfLines={2}>
              {item.flagReason ?? 'Flagged for review, tap to see why'}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.amber} />
          </View>
        ) : null}
      </Pressable>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={gradients.header} style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.headerTitle}>Visits</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryVal}>{allMs > 0 ? formatHm(allMs) : '0m'}</Text>
            <Text style={styles.summaryLabel}>All-time hours</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryVal}>{weekMs > 0 ? formatHm(weekMs) : '0m'}</Text>
            <Text style={styles.summaryLabel}>This week</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryVal}>{completedCount}</Text>
            <Text style={styles.summaryLabel}>Completed</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.filterRow}>
        {(['all', 'verified', 'flagged'] as Filter[]).map((f) => (
          <Pressable
            key={f}
            onPress={() => {
              if (filter === f) return;
              void Haptics.selectionAsync();
              setFilter(f);
            }}
            style={({ pressed }) => [
              styles.filterChip,
              filter === f && styles.filterChipActive,
              pressed && { transform: [{ scale: 0.96 }] },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === f }}
            accessibilityLabel={`Show ${f === 'all' ? 'all' : f} visits`}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f === 'all' ? 'All' : f === 'verified' ? 'Verified' : 'Flagged'}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.skeletonPad}>
          <SkeletonList count={5} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(v) => v.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandBlue} />}
          ListEmptyComponent={
            error ? (
              <ErrorRetry message={error} onRetry={load} />
            ) : (
              <EmptyState
                icon="time-outline"
                title="No visits yet"
                message={
                  filter === 'all'
                    ? 'Your completed visits will show up here.'
                    : `No ${filter} visits.`
                }
              />
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { ...typography.title, color: colors.onGradient, marginBottom: 16 },
  summaryRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#ffffff14', borderRadius: radii.lg, paddingVertical: 14,
    borderWidth: 1, borderColor: '#ffffff1f',
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryVal: { color: colors.onGradient, fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'] },
  summaryLabel: { ...typography.caption, color: colors.onGradientSoft, marginTop: 3 },
  summaryDivider: { width: 1, height: 30, backgroundColor: '#ffffff24' },

  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: radii.pill,
    backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.brandBlue, borderColor: colors.brandBlue },
  filterChipText: { ...typography.sub, fontWeight: '700', color: colors.textSecondary },
  filterChipTextActive: { color: colors.onGradient },

  skeletonPad: { padding: 16, paddingTop: 10 },
  list: { padding: 16, paddingTop: 10, gap: 12 },

  card: {
    backgroundColor: colors.cardBg, borderRadius: radii.lg, padding: 16,
    ...shadow.card,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardDay: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 4 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { ...typography.caption, fontWeight: '800' },
  cardClient: { ...typography.heading, color: colors.textPrimary, marginTop: 8 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  cardTime: { ...typography.sub, color: colors.textSecondary },
  cardDuration: { fontSize: 15, fontWeight: '900', color: colors.brandBlue, fontVariant: ['tabular-nums'] },
  cardService: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
  flagRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10,
    backgroundColor: colors.amberBg, borderRadius: radii.sm, padding: 10,
    borderWidth: 1, borderColor: colors.amberBorder,
  },
  flagText: { flex: 1, fontSize: 12, color: colors.amberDark, lineHeight: 17, fontWeight: '600' },
});
