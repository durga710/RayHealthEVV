import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
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
import { useRouter } from 'expo-router';
import apiClient from '../../lib/api-client';

type EnrollmentStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue' | 'expired';

interface Course {
  id: string;
  code: string;
  title: string;
  description: string;
  required: boolean;
  durationMinutes: number;
  externalUrl: string | null;
}

interface Enrollment {
  id: string;
  courseId: string;
  dueAt: string | null;
  status: EnrollmentStatus;
}

interface EnrollmentRow {
  enrollment: Enrollment;
  course: Course;
}

interface ProgressData {
  enrollments: EnrollmentRow[];
  isCompliant: boolean;
}

const STATUS_META: Record<EnrollmentStatus, { label: string; color: string }> = {
  completed: { label: 'Completed', color: '#16a34a' },
  in_progress: { label: 'In progress', color: '#1a5fa8' },
  not_started: { label: 'Not started', color: '#64748b' },
  overdue: { label: 'Overdue', color: '#dc2626' },
  expired: { label: 'Expired', color: '#d97706' },
};

function formatDue(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
    : null;
}

export default function TrainingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<ProgressData | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get<{ success: boolean; data: ProgressData }>('/api/learning/progress');
      if (res.data?.success) setData(res.data.data);
    } catch {
      // Leave data null; empty state covers it.
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

  const handleStart = async (row: EnrollmentRow) => {
    setBusyId(row.enrollment.id);
    try {
      await apiClient.post('/api/learning/start', { enrollmentId: row.enrollment.id });
      if (row.course.externalUrl) {
        await Linking.openURL(row.course.externalUrl);
      } else {
        Alert.alert('Course started', 'This course has been marked in progress.');
      }
      await load();
    } catch {
      Alert.alert('Could not start', 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const handleCertificate = async (row: EnrollmentRow) => {
    setBusyId(row.enrollment.id);
    try {
      const res = await apiClient.get<{
        success: boolean;
        data: { courseTitle: string; completedAt: string; expiresAt: string | null; verificationCode: string };
      }>(`/api/learning/certificate/${row.course.id}`);
      const c = res.data.data;
      const completed = new Date(c.completedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
      const expires = c.expiresAt
        ? new Date(c.expiresAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
        : 'No expiry';
      Alert.alert(
        `Certificate · ${c.courseTitle}`,
        `Completed: ${completed}\nExpires: ${expires}\nVerification: ${c.verificationCode}`,
      );
    } catch {
      Alert.alert('No certificate', 'No completed record was found for this course.');
    } finally {
      setBusyId(null);
    }
  };

  const renderItem = ({ item }: { item: EnrollmentRow }) => {
    const meta = STATUS_META[item.enrollment.status] ?? STATUS_META.not_started;
    const due = formatDue(item.enrollment.dueAt);
    const isCompleted = item.enrollment.status === 'completed';
    const busy = busyId === item.enrollment.id;

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.titleWrap}>
            <Text style={styles.cardTitle} numberOfLines={2}>{item.course.title}</Text>
            {item.course.required ? (
              <View style={styles.reqPill}>
                <Text style={styles.reqText}>REQUIRED</Text>
              </View>
            ) : null}
          </View>
          <View style={[styles.statusPill, { backgroundColor: `${meta.color}1a` }]}>
            <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>

        {item.course.description ? (
          <Text style={styles.cardDesc} numberOfLines={2}>{item.course.description}</Text>
        ) : null}

        <View style={styles.cardMetaRow}>
          {item.course.durationMinutes > 0 ? (
            <Text style={styles.metaText}>⏱ {item.course.durationMinutes} min</Text>
          ) : null}
          {due ? <Text style={styles.metaText}>Due {due}</Text> : null}
        </View>

        <Pressable
          onPress={() => (isCompleted ? handleCertificate(item) : handleStart(item))}
          disabled={busy}
          style={({ pressed }) => [
            styles.actionBtn,
            isCompleted ? styles.actionBtnGhost : styles.actionBtnPrimary,
            pressed && { opacity: 0.9 },
          ]}
        >
          {busy ? (
            <ActivityIndicator color={isCompleted ? '#1a5fa8' : '#fff'} size="small" />
          ) : (
            <>
              <Ionicons
                name={isCompleted ? 'ribbon-outline' : 'play-circle-outline'}
                size={16}
                color={isCompleted ? '#1a5fa8' : '#fff'}
              />
              <Text style={[styles.actionText, isCompleted ? styles.actionTextGhost : styles.actionTextPrimary]}>
                {isCompleted ? 'View certificate' : item.enrollment.status === 'in_progress' ? 'Continue' : 'Start course'}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={['#0f2d52', '#1a5fa8']} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={22} color="#cfe2f5" />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>My Training</Text>
        {data ? (
          <View style={[styles.complianceBanner, data.isCompliant ? styles.compliantOk : styles.compliantWarn]}>
            <Ionicons
              name={data.isCompliant ? 'shield-checkmark' : 'alert-circle'}
              size={16}
              color={data.isCompliant ? '#bbf7d0' : '#fde68a'}
            />
            <Text style={styles.complianceText}>
              {data.isCompliant
                ? "You're up to date on required training"
                : 'Some required training needs your attention'}
            </Text>
          </View>
        ) : null}
      </LinearGradient>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#1a5fa8" />
        </View>
      ) : (
        <FlatList
          data={data?.enrollments ?? []}
          keyExtractor={(r) => r.enrollment.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1a5fa8" />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="school-outline" size={40} color="#9db3c8" />
              <Text style={styles.emptyTitle}>No training assigned</Text>
              <Text style={styles.emptyNote}>Courses assigned by your agency will appear here.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef3f8' },
  header: { paddingHorizontal: 16, paddingBottom: 18 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 1, paddingVertical: 4, alignSelf: 'flex-start' },
  backText: { color: '#cfe2f5', fontSize: 16, fontWeight: '700' },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.3, marginTop: 6 },
  complianceBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginTop: 14,
    borderWidth: 1,
  },
  compliantOk: { backgroundColor: '#16a34a22', borderColor: '#16a34a45' },
  compliantWarn: { backgroundColor: '#f59e0b22', borderColor: '#f59e0b45' },
  complianceText: { color: '#fff', fontSize: 13, fontWeight: '700', flex: 1 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 12 },

  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#0f2d52', shadowOpacity: 0.05, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  titleWrap: { flex: 1, gap: 6 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#0f2d52', lineHeight: 20 },
  reqPill: { alignSelf: 'flex-start', backgroundColor: '#fef3c7', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  reqText: { fontSize: 9, fontWeight: '900', color: '#b45309', letterSpacing: 0.5 },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { fontSize: 11, fontWeight: '800' },
  cardDesc: { fontSize: 13, color: '#5a7088', lineHeight: 18, marginTop: 10 },
  cardMetaRow: { flexDirection: 'row', gap: 14, marginTop: 10 },
  metaText: { fontSize: 12, color: '#8499ad', fontWeight: '600' },

  actionBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7,
    height: 44, borderRadius: 12, marginTop: 14,
  },
  actionBtnPrimary: { backgroundColor: '#1a5fa8' },
  actionBtnGhost: { backgroundColor: '#f0f6fd', borderWidth: 1, borderColor: '#d6e6f7' },
  actionText: { fontSize: 14, fontWeight: '800' },
  actionTextPrimary: { color: '#fff' },
  actionTextGhost: { color: '#1a5fa8' },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#0f2d52', marginTop: 8 },
  emptyNote: { fontSize: 13, color: '#5a7088', textAlign: 'center', lineHeight: 19 },
});
