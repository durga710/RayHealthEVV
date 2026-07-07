import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import apiClient from '../../lib/api-client';
import type { CourseModules } from '../../lib/course-player';
import { showCertificateAlert } from './certificate';
import ScreenHeader from '../common/ScreenHeader';
import ErrorRetry from '../common/ErrorRetry';
import EmptyState from '../common/EmptyState';
import { showAppAlert, showAppToast } from '../common/alerts/appAlert';
import { SkeletonList } from '../common/Skeleton';
import { colors, typography, radii, shadow, alpha } from '../common/tokens';

type EnrollmentStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue' | 'expired';

interface Course {
  id: string;
  code: string;
  title: string;
  description: string;
  required: boolean;
  durationMinutes: number;
  externalUrl: string | null;
  modules: CourseModules | null;
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
  completed: { label: 'Completed', color: colors.success },
  in_progress: { label: 'In progress', color: colors.brandBlue },
  not_started: { label: 'Not started', color: colors.slate },
  overdue: { label: 'Overdue', color: colors.danger },
  expired: { label: 'Expired', color: colors.amber },
};

function formatDue(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
    : null;
}

export default function TrainingScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<ProgressData | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get<{ success: boolean; data: ProgressData }>('/api/learning/progress');
      if (res.data?.success) setData(res.data.data);
      setError(null);
    } catch {
      setError('Could not load your training.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const handleStart = async (row: EnrollmentRow) => {
    // In-app course content opens the guided player, which marks the
    // enrollment in-progress itself.
    if (row.course.modules) {
      router.push({
        pathname: '/course-player',
        params: { courseId: row.course.id, enrollmentId: row.enrollment.id },
      });
      return;
    }
    setBusyId(row.enrollment.id);
    try {
      await apiClient.post('/api/learning/start', { enrollmentId: row.enrollment.id });
      if (row.course.externalUrl) {
        await Linking.openURL(row.course.externalUrl);
      } else {
        showAppToast({ message: "You're on your way — this course is now in progress.", variant: 'success', icon: 'play-circle' });
      }
      await load();
    } catch {
      showAppAlert('Could not start course', 'Please try again.', undefined, { variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const handleCertificate = async (row: EnrollmentRow) => {
    setBusyId(row.enrollment.id);
    try {
      await showCertificateAlert(row.course.id);
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
          <View style={[styles.statusPill, { backgroundColor: `${meta.color}${alpha.tint}` }]}>
            <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>

        {item.course.description ? (
          <Text style={styles.cardDesc} numberOfLines={2}>{item.course.description}</Text>
        ) : null}

        <View style={styles.cardMetaRow}>
          {item.course.durationMinutes > 0 ? (
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={12} color={colors.textMuted} />
              <Text style={styles.metaText}>{item.course.durationMinutes} min</Text>
            </View>
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
            <ActivityIndicator color={isCompleted ? colors.brandBlue : '#fff'} size="small" />
          ) : (
            <>
              <Ionicons
                name={isCompleted ? 'ribbon-outline' : 'play-circle-outline'}
                size={16}
                color={isCompleted ? colors.brandBlue : '#fff'}
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
      <ScreenHeader title="My Training">
        {data ? (
          <View style={[styles.complianceBanner, data.isCompliant ? styles.compliantOk : styles.compliantWarn]}>
            <Ionicons
              name={data.isCompliant ? 'shield-checkmark' : 'alert-circle'}
              size={16}
              color={data.isCompliant ? colors.successBorder : colors.amberBorder}
            />
            <Text style={styles.complianceText}>
              {data.isCompliant
                ? "You're up to date on required training"
                : 'Some required training needs your attention'}
            </Text>
          </View>
        ) : null}
      </ScreenHeader>

      {loading ? (
        <View style={styles.skeletonPad}>
          <SkeletonList count={4} />
        </View>
      ) : (
        <FlatList
          data={data?.enrollments ?? []}
          keyExtractor={(r) => r.enrollment.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandBlue} />}
          ListEmptyComponent={
            error ? (
              <ErrorRetry message={error} onRetry={load} />
            ) : (
              <EmptyState
                icon="school-outline"
                title="No training assigned"
                message="Courses assigned by your agency will appear here."
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
  complianceBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginTop: 14,
    borderWidth: 1,
  },
  compliantOk: { backgroundColor: `${colors.success}22`, borderColor: `${colors.success}45` },
  compliantWarn: { backgroundColor: '#f59e0b22', borderColor: '#f59e0b45' },
  complianceText: { color: '#fff', ...typography.sub, fontWeight: '700', flex: 1 },

  skeletonPad: { padding: 16 },
  list: { padding: 16, gap: 12 },

  card: {
    backgroundColor: colors.cardBg, borderRadius: radii.lg, padding: 16,
    ...shadow.card,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  titleWrap: { flex: 1, gap: 6 },
  cardTitle: { ...typography.heading, color: colors.textPrimary, lineHeight: 21 },
  reqPill: { alignSelf: 'flex-start', backgroundColor: colors.amberBg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: colors.amberBorder },
  reqText: { fontSize: 9, fontWeight: '900', color: colors.amberDark, letterSpacing: 0.5 },
  statusPill: { borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { ...typography.caption, fontWeight: '800' },
  cardDesc: { ...typography.sub, color: colors.textSecondary, lineHeight: 18, marginTop: 10 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },

  actionBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7,
    height: 44, borderRadius: 12, marginTop: 14,
  },
  actionBtnPrimary: { backgroundColor: colors.brandBlue },
  actionBtnGhost: { backgroundColor: '#f0f6fd', borderWidth: 1, borderColor: '#d6e6f7' },
  actionText: { fontSize: 14, fontWeight: '800' },
  actionTextPrimary: { color: '#fff' },
  actionTextGhost: { color: colors.brandBlue },
});
