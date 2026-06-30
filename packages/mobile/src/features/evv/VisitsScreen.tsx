import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import apiClient from '../../lib/api-client';

type VisitStatus = 'pending' | 'verified' | 'flagged';

interface EvvVisit {
  id: string;
  clientId?: string;
  serviceCode?: string;
  clockInTime: string;
  clockOutTime?: string;
  status: VisitStatus;
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
    : '—';
}

function formatTime(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isFinite(d.getTime())
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
    : '—';
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [visits, setVisits] = useState<EvvVisit[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    try {
      const [visitsRes, assignmentsRes] = await Promise.allSettled([
        apiClient.get<EvvVisit[]>('/api/evv/visits'),
        apiClient.get<CaregiverAssignmentRow[]>('/api/assignments/caregiver'),
      ]);
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

  useEffect(() => {
    void load();
  }, [load]);

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

  const renderItem = ({ item }: { item: EvvVisit }) => {
    const ms = durationMs(item);
    const inProgress = !item.clockOutTime;
    const statusColor =
      item.status === 'verified' ? '#16a34a' : item.status === 'flagged' ? '#d97706' : '#64748b';
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
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.cardDay}>{formatDay(item.clockInTime)}</Text>
          <View style={[styles.statusPill, { backgroundColor: `${statusColor}1a` }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>
        {client ? <Text style={styles.cardClient} numberOfLines={1}>{client}</Text> : null}
        <View style={styles.cardMetaRow}>
          <Text style={styles.cardTime}>
            {formatTime(item.clockInTime)} – {inProgress ? 'now' : formatTime(item.clockOutTime)}
          </Text>
          <Text style={styles.cardDuration}>{ms != null ? formatHm(ms) : '—'}</Text>
        </View>
        <Text style={styles.cardService}>{service}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={['#0f2d52', '#1a5fa8']} style={[styles.header, { paddingTop: insets.top + 16 }]}>
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
            onPress={() => setFilter(f)}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f === 'all' ? 'All' : f === 'verified' ? 'Verified' : 'Flagged'}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#1a5fa8" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(v) => v.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1a5fa8" />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No visits yet</Text>
              <Text style={styles.emptyNote}>
                {filter === 'all'
                  ? 'Your completed visits will show up here.'
                  : `No ${filter} visits.`}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef3f8' },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.3, marginBottom: 16 },
  summaryRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#ffffff14', borderRadius: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: '#ffffff1f',
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryVal: { color: '#fff', fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'] },
  summaryLabel: { color: '#a8c8e8', fontSize: 11, fontWeight: '600', marginTop: 3 },
  summaryDivider: { width: 1, height: 30, backgroundColor: '#ffffff24' },

  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#dce4ec',
  },
  filterChipActive: { backgroundColor: '#1a5fa8', borderColor: '#1a5fa8' },
  filterChipText: { fontSize: 13, fontWeight: '700', color: '#5a7088' },
  filterChipTextActive: { color: '#fff' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, paddingTop: 10, gap: 12 },

  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#0f2d52', shadowOpacity: 0.05, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardDay: { fontSize: 14, fontWeight: '800', color: '#0f2d52' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '800' },
  cardClient: { fontSize: 15, fontWeight: '700', color: '#1a3a5c', marginTop: 8 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  cardTime: { fontSize: 13, color: '#5a7088' },
  cardDuration: { fontSize: 15, fontWeight: '900', color: '#1a5fa8', fontVariant: ['tabular-nums'] },
  cardService: { fontSize: 12, color: '#8499ad', marginTop: 6 },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#0f2d52', marginBottom: 6 },
  emptyNote: { fontSize: 13, color: '#5a7088', textAlign: 'center', lineHeight: 19 },
});
