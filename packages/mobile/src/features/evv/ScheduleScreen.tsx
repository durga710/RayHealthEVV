import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import apiClient from '../../lib/api-client';

interface ScheduleRow {
  assignmentId: string;
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  clientFirstName: string;
  clientLastName: string;
  clientAddressLine1: string | null;
  clientCity: string | null;
  clientState: string | null;
  clientLatitude: number | null;
  clientLongitude: number | null;
  geofenceRadiusM: number;
  templateName: string;
  currentVisitId: string | null;
  currentVisitStatus: string | null;
  currentClockInTime: string | null;
  currentClockOutTime: string | null;
}

interface Section {
  title: string;
  data: ScheduleRow[];
}

function dayKey(iso: string | null): string {
  if (!iso) return 'unscheduled';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return 'unscheduled';
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string | null): string {
  if (!iso) return 'Unscheduled';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return 'Unscheduled';
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  if (dayKey(iso) === dayKey(today.toISOString())) return 'Today';
  if (dayKey(iso) === dayKey(tomorrow.toISOString())) return 'Tomorrow';
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

function formatTime(iso: string | null): string {
  if (!iso) return 'On call';
  const d = new Date(iso);
  return Number.isFinite(d.getTime())
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
    : '—';
}

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<ScheduleRow[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get<{ schedule: ScheduleRow[] }>('/api/mobile/caregiver/schedule?days=7');
      setRows(res.data?.schedule ?? []);
    } catch {
      setRows([]);
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

  const sections = useMemo<Section[]>(() => {
    const groups = new Map<string, Section>();
    for (const r of rows) {
      const key = dayKey(r.scheduledStartTime);
      if (!groups.has(key)) groups.set(key, { title: dayLabel(r.scheduledStartTime), data: [] });
      groups.get(key)!.data.push(r);
    }
    return Array.from(groups.values());
  }, [rows]);

  const openVisit = (r: ScheduleRow) => {
    const address = [r.clientAddressLine1, r.clientCity, r.clientState].filter(Boolean).join(', ');
    const inProgress = r.currentVisitId && !r.currentClockOutTime;
    router.push({
      pathname: '/clockin',
      params: {
        assignmentId: r.assignmentId,
        clientName: `${r.clientFirstName} ${r.clientLastName}`.trim(),
        ...(address ? { clientAddress: address } : {}),
        ...(r.scheduledStartTime ? { scheduledTime: r.scheduledStartTime } : {}),
        ...(r.clientLatitude != null ? { clientLat: String(r.clientLatitude) } : {}),
        ...(r.clientLongitude != null ? { clientLng: String(r.clientLongitude) } : {}),
        clientGeofenceM: String(r.geofenceRadiusM),
        ...(inProgress ? { openVisitId: r.currentVisitId as string } : {}),
        ...(inProgress && r.currentClockInTime ? { clockInTime: r.currentClockInTime } : {}),
      },
    });
  };

  const renderItem = ({ item }: { item: ScheduleRow }) => {
    const address = [item.clientAddressLine1, item.clientCity, item.clientState].filter(Boolean).join(', ');
    const inProgress = item.currentVisitId && !item.currentClockOutTime;
    const completed = !!item.currentClockOutTime;
    return (
      <Pressable
        onPress={() => openVisit(item)}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
      >
        <View style={styles.timeCol}>
          <Text style={styles.timeText}>{formatTime(item.scheduledStartTime)}</Text>
          {item.scheduledEndTime ? (
            <Text style={styles.timeEnd}>{formatTime(item.scheduledEndTime)}</Text>
          ) : null}
        </View>
        <View style={styles.divider} />
        <View style={styles.infoCol}>
          <Text style={styles.clientName} numberOfLines={1}>
            {`${item.clientFirstName} ${item.clientLastName}`.trim()}
          </Text>
          {address ? (
            <Text style={styles.addr} numberOfLines={1}>📍 {address}</Text>
          ) : null}
          <View style={styles.tagRow}>
            <Text style={styles.template} numberOfLines={1}>{item.templateName}</Text>
            {inProgress ? (
              <View style={[styles.statusTag, styles.tagActive]}>
                <Text style={styles.tagActiveText}>In progress</Text>
              </View>
            ) : completed ? (
              <View style={[styles.statusTag, styles.tagDone]}>
                <Text style={styles.tagDoneText}>Completed</Text>
              </View>
            ) : null}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#bcccdc" />
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={['#0f2d52', '#1a5fa8']} style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.headerTitle}>Schedule</Text>
        <Text style={styles.headerSub}>Next 7 days</Text>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#1a5fa8" />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.assignmentId}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1a5fa8" />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={40} color="#9db3c8" />
              <Text style={styles.emptyTitle}>Nothing scheduled</Text>
              <Text style={styles.emptyNote}>Your upcoming visits for the next 7 days will appear here.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef3f8' },
  header: { paddingHorizontal: 20, paddingBottom: 18 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  headerSub: { color: '#a8c8e8', fontSize: 13, fontWeight: '600', marginTop: 3 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, paddingBottom: 40 },
  sectionHeader: {
    fontSize: 13, fontWeight: '900', color: '#4a6480',
    textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 14, marginBottom: 8,
  },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10,
    shadowColor: '#0f2d52', shadowOpacity: 0.05, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  timeCol: { width: 64, alignItems: 'center' },
  timeText: { fontSize: 14, fontWeight: '900', color: '#1a5fa8' },
  timeEnd: { fontSize: 11, color: '#8499ad', marginTop: 2 },
  divider: { width: 1, alignSelf: 'stretch', backgroundColor: '#eaf0f6' },
  infoCol: { flex: 1, gap: 3 },
  clientName: { fontSize: 15, fontWeight: '800', color: '#0f2d52' },
  addr: { fontSize: 12, color: '#5a7088' },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  template: { flex: 1, fontSize: 12, color: '#8499ad' },
  statusTag: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  tagActive: { backgroundColor: '#dcfce7' },
  tagActiveText: { fontSize: 10, fontWeight: '800', color: '#15803d' },
  tagDone: { backgroundColor: '#e2e8f0' },
  tagDoneText: { fontSize: 10, fontWeight: '800', color: '#475569' },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#0f2d52', marginTop: 8 },
  emptyNote: { fontSize: 13, color: '#5a7088', textAlign: 'center', lineHeight: 19 },
});
