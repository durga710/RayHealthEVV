import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import apiClient from '../../lib/api-client';
import {
  buildTaskDraft,
  createClientEventId,
  isTaskDraftComplete,
  setTaskDraftStatus,
  toTaskCompletionPayload,
  type PersistedVisitTaskCompletion,
  type VisitTaskDraftItem,
  type VisitTaskPlanItem,
  type VisitTaskStatus,
} from '../../lib/visit-task-state';
import ScreenHeader from '../common/ScreenHeader';
import ErrorRetry from '../common/ErrorRetry';
import LoadingScreen from '../common/LoadingScreen';
import { showAppToast } from '../common/alerts/appAlert';
import { colors, gradients, radii, shadow, typography } from '../common/tokens';
import { LinearGradient } from 'expo-linear-gradient';

interface TaskStateResponse {
  plan: VisitTaskPlanItem[];
  completions: PersistedVisitTaskCompletion[];
}

const OPTIONS: {
  status: VisitTaskStatus;
  label: string;
  icon: 'checkmark-circle' | 'hand-left' | 'remove-circle';
  color: string;
}[] = [
  { status: 'performed', label: 'Performed', icon: 'checkmark-circle', color: colors.success },
  { status: 'refused', label: 'Refused', icon: 'hand-left', color: colors.amberDark },
  { status: 'not_performed', label: 'Not done', icon: 'remove-circle', color: colors.danger },
];

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function VisitTasksScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const visitId = one(params.visitId);
  const clientName = one(params.clientName) ?? 'this visit';
  const [draft, setDraft] = useState<VisitTaskDraftItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!visitId) {
      setError('The visit identifier is missing. Return to your schedule and try again.');
      return;
    }
    setError(null);
    try {
      const { data } = await apiClient.get<TaskStateResponse>(`/api/evv/visits/${visitId}/tasks`);
      setDraft(buildTaskDraft(data.plan ?? [], data.completions ?? []));
    } catch {
      setError('We could not load the care plan. Check your connection and try again.');
    }
  }, [visitId]);

  useEffect(() => {
    void load();
  }, [load]);

  const choose = (index: number, status: VisitTaskStatus) => {
    setDraft((current) => current
      ? setTaskDraftStatus(current, index, status, createClientEventId())
      : current);
  };

  const finish = () => {
    router.replace('/(tabs)/dashboard');
  };

  const submit = async () => {
    if (!visitId || !draft || !isTaskDraftComplete(draft)) return;
    setSaving(true);
    try {
      await apiClient.put(`/api/evv/visits/${visitId}/tasks`, {
        completions: toTaskCompletionPayload(draft),
      });
      showAppToast({ message: 'Care-plan tasks saved.', variant: 'success' });
      finish();
    } catch {
      showAppToast({
        message: 'Tasks were not saved. Your selections are still here—try again.',
        variant: 'warning',
      });
    } finally {
      setSaving(false);
    }
  };

  if (draft === null && !error) return <LoadingScreen />;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Care-plan tasks" />
      {error ? (
        <View style={styles.center}>
          <ErrorRetry message={error} onRetry={load} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.intro}>
            <Ionicons name="clipboard-outline" size={22} color={colors.brandBlue} />
            <View style={styles.introCopy}>
              <Text style={styles.title}>Record services for {clientName}</Text>
              <Text style={styles.subtitle}>Choose one outcome for every scheduled task.</Text>
            </View>
          </View>

          {draft?.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="checkmark-done" size={30} color={colors.success} />
              <Text style={styles.emptyTitle}>No care tasks assigned</Text>
              <Text style={styles.emptyText}>The visit is complete and there is nothing else to record.</Text>
            </View>
          ) : (
            draft?.map((task, index) => (
              <View key={`${task.taskCode ?? ''}:${task.taskLabel}`} style={styles.card}>
                <View style={styles.taskHeading}>
                  {task.taskCode ? <Text style={styles.code}>{task.taskCode}</Text> : null}
                  <Text style={styles.taskLabel}>{task.taskLabel}</Text>
                </View>
                <View style={styles.options} accessibilityRole="radiogroup">
                  {OPTIONS.map((option) => {
                    const selected = task.status === option.status;
                    return (
                      <Pressable
                        key={option.status}
                        onPress={() => choose(index, option.status)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected }}
                        accessibilityLabel={`${task.taskLabel}: ${option.label}`}
                        style={({ pressed }) => [
                          styles.option,
                          selected && { borderColor: option.color, backgroundColor: `${option.color}12` },
                          pressed && { opacity: 0.75 },
                        ]}
                      >
                        <Ionicons
                          name={option.icon}
                          size={18}
                          color={selected ? option.color : colors.textMuted}
                        />
                        <Text style={[styles.optionText, selected && { color: option.color }]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))
          )}

          {draft?.length === 0 ? (
            <Pressable onPress={finish} style={styles.doneButton} accessibilityRole="button">
              <Text style={styles.doneButtonText}>Return to dashboard</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => void submit()}
              disabled={saving || !draft || !isTaskDraftComplete(draft)}
              accessibilityRole="button"
              accessibilityState={{ disabled: saving || !draft || !isTaskDraftComplete(draft) }}
              style={({ pressed }) => [styles.submitWrap, pressed && { opacity: 0.9 }]}
            >
              <LinearGradient
                colors={isTaskDraftComplete(draft ?? []) ? gradients.cta : gradients.ctaDisabled}
                style={styles.submit}
              >
                {saving ? <ActivityIndicator color={colors.onGradient} /> : <Ionicons name="cloud-upload-outline" size={20} color={colors.onGradient} />}
                <Text style={styles.submitText}>{saving ? 'Saving…' : 'Save care tasks'}</Text>
              </LinearGradient>
            </Pressable>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },
  center: { flex: 1, justifyContent: 'center', padding: 20 },
  scroll: { padding: 16, paddingBottom: 42, gap: 14 },
  intro: {
    flexDirection: 'row', gap: 12, padding: 16, backgroundColor: colors.cardBg,
    borderRadius: radii.lg, ...shadow.subtle,
  },
  introCopy: { flex: 1 },
  title: { ...typography.heading, color: colors.textPrimary },
  subtitle: { ...typography.sub, color: colors.textSecondary, marginTop: 4 },
  card: { backgroundColor: colors.cardBg, borderRadius: radii.lg, padding: 16, ...shadow.card },
  taskHeading: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 13 },
  code: {
    color: colors.brandBlue, backgroundColor: '#eaf2fb', borderRadius: radii.pill,
    paddingHorizontal: 9, paddingVertical: 4, fontSize: 11, fontWeight: '900',
  },
  taskLabel: { flex: 1, ...typography.body, fontWeight: '800', color: colors.textPrimary },
  options: { flexDirection: 'row', gap: 7 },
  option: {
    flex: 1, minHeight: 52, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 4,
  },
  optionText: { fontSize: 11, fontWeight: '800', color: colors.textMuted, textAlign: 'center' },
  submitWrap: { borderRadius: radii.lg, marginTop: 4 },
  submit: { height: 58, borderRadius: radii.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  submitText: { color: colors.onGradient, fontSize: 16, fontWeight: '900' },
  emptyCard: { backgroundColor: colors.cardBg, borderRadius: radii.lg, padding: 28, alignItems: 'center', ...shadow.card },
  emptyTitle: { ...typography.heading, color: colors.textPrimary, marginTop: 10 },
  emptyText: { ...typography.sub, color: colors.textSecondary, textAlign: 'center', marginTop: 6 },
  doneButton: { height: 54, borderRadius: radii.lg, backgroundColor: colors.brandBlue, alignItems: 'center', justifyContent: 'center' },
  doneButtonText: { color: colors.onGradient, fontSize: 16, fontWeight: '900' },
});
