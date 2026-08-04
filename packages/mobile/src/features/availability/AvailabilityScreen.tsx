import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import apiClient from '../../lib/api-client';
import ScreenHeader from '../common/ScreenHeader';
import ErrorRetry from '../common/ErrorRetry';
import { SkeletonList } from '../common/Skeleton';
import { showAppAlert } from '../common/alerts/appAlert';
import { alpha, colors, radii, shadow, typography } from '../common/tokens';
import {
  DAY_LABELS,
  DEFAULT_END,
  DEFAULT_START,
  dayCount,
  emptyGrid,
  formatDateRange,
  gridFromSlots,
  slotsFromGrid,
  validateGrid,
  type AvailabilitySlot,
  type TimeOffRequest,
  type WeekGrid,
} from '../../lib/availability';

/**
 * Availability and time off.
 *
 * Two things a caregiver controls about their own schedule: the hours they
 * normally work, and specific days they need off. The screen is explicit that
 * these carry different weight, because scheduling treats them differently:
 * availability is a preference the agency can book around, approved time off
 * is a commitment it will not book over.
 */

const STATUS_META: Record<
  TimeOffRequest['status'],
  { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  requested: { label: 'Awaiting answer', color: colors.amber, icon: 'time-outline' },
  approved: { label: 'Approved', color: colors.success, icon: 'checkmark-circle-outline' },
  denied: { label: 'Not approved', color: colors.danger, icon: 'close-circle-outline' },
  cancelled: { label: 'Cancelled', color: colors.textMuted, icon: 'remove-circle-outline' },
};

export default function AvailabilityScreen() {
  const [grid, setGrid] = useState<WeekGrid>(emptyGrid());
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingWeek, setSavingWeek] = useState(false);
  const [weekError, setWeekError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [availability, timeOff] = await Promise.all([
        apiClient.get<{ slots: AvailabilitySlot[] }>('/api/availability'),
        apiClient.get<{ requests: TimeOffRequest[] }>('/api/availability/time-off'),
      ]);
      setGrid(gridFromSlots(availability.data?.slots ?? []));
      setRequests(timeOff.data?.requests ?? []);
      setError(null);
    } catch {
      setError('Could not load your availability.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const toggleDay = (day: number, enabled: boolean) => {
    void Haptics.selectionAsync();
    setWeekError(null);
    setGrid((prev) => {
      const next = [...prev];
      next[day] = enabled
        ? { enabled: true, startTime: prev[day].startTime || DEFAULT_START, endTime: prev[day].endTime || DEFAULT_END }
        : { ...prev[day], enabled: false };
      return next;
    });
  };

  const setDayTime = (day: number, field: 'startTime' | 'endTime', value: string) => {
    setWeekError(null);
    setGrid((prev) => {
      const next = [...prev];
      next[day] = { ...prev[day], [field]: value };
      return next;
    });
  };

  const saveWeek = async () => {
    const problem = validateGrid(grid);
    if (problem) {
      setWeekError(problem);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setSavingWeek(true);
    try {
      await apiClient.put('/api/availability', { slots: slotsFromGrid(grid) });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      showAppAlert('Could not save your availability', 'Please try again.', undefined, {
        variant: 'error',
      });
    } finally {
      setSavingWeek(false);
    }
  };

  const submitTimeOff = async () => {
    const start = startDate.trim();
    const end = (endDate.trim() || start);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      setFormError('Enter dates as YYYY-MM-DD, for example 2026-09-01.');
      return;
    }
    if (end < start) {
      setFormError('The last day cannot be before the first day.');
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      await apiClient.post('/api/availability/time-off', {
        startDate: start,
        endDate: end,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      setStartDate('');
      setEndDate('');
      setReason('');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load();
    } catch {
      showAppAlert('Could not send that request', 'Please try again.', undefined, { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const cancelRequest = (req: TimeOffRequest) => {
    showAppAlert(
      'Cancel this request?',
      `${formatDateRange(req.startDate, req.endDate)} will be withdrawn.`,
      [
        { text: 'Keep it' },
        {
          text: 'Cancel it',
          onPress: () => {
            void (async () => {
              try {
                await apiClient.delete(`/api/availability/time-off/${req.id}`);
                await load();
              } catch {
                showAppAlert('Could not cancel that request', 'Please try again.', undefined, {
                  variant: 'error',
                });
              }
            })();
          },
        },
      ],
      { variant: 'warning' },
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader title="Availability" />
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
      >
        {loading ? (
          <SkeletonList count={4} />
        ) : error ? (
          <ErrorRetry message={error} onRetry={() => { setLoading(true); void load(); }} />
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>My usual week</Text>
              <Text style={styles.cardHint}>
                The hours you can normally work. Your agency uses this as a guide, so a shift
                outside these hours is still possible.
              </Text>

              {DAY_LABELS.map((label, day) => (
                <View key={label} style={styles.dayRow}>
                  <View style={styles.dayLeft}>
                    <Switch
                      value={grid[day].enabled}
                      onValueChange={(v) => toggleDay(day, v)}
                      trackColor={{ true: colors.brandBlue, false: colors.border }}
                      accessibilityLabel={`Available on ${label}`}
                    />
                    <Text style={styles.dayLabel}>{label}</Text>
                  </View>
                  {grid[day].enabled ? (
                    <View style={styles.timeInputs}>
                      <TextInput
                        value={grid[day].startTime}
                        onChangeText={(t) => setDayTime(day, 'startTime', t)}
                        placeholder="09:00"
                        placeholderTextColor={colors.textMuted}
                        style={styles.timeInput}
                        maxLength={5}
                        accessibilityLabel={`${label} start time`}
                      />
                      <Text style={styles.timeDash}>to</Text>
                      <TextInput
                        value={grid[day].endTime}
                        onChangeText={(t) => setDayTime(day, 'endTime', t)}
                        placeholder="17:00"
                        placeholderTextColor={colors.textMuted}
                        style={styles.timeInput}
                        maxLength={5}
                        accessibilityLabel={`${label} end time`}
                      />
                    </View>
                  ) : (
                    <Text style={styles.dayOff}>Not available</Text>
                  )}
                </View>
              ))}

              {weekError ? <Text style={styles.formError}>{weekError}</Text> : null}
              <Pressable
                onPress={() => void saveWeek()}
                disabled={savingWeek}
                style={({ pressed }) => [styles.primaryBtn, pressed && !savingWeek && { opacity: 0.9 }]}
                accessibilityRole="button"
                accessibilityLabel="Save my weekly availability"
              >
                {savingWeek ? (
                  <ActivityIndicator color={colors.onGradient} />
                ) : (
                  <Text style={styles.primaryBtnText}>Save my week</Text>
                )}
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Request time off</Text>
              <Text style={styles.cardHint}>
                Once approved, your agency will not schedule you on these days.
              </Text>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>First day</Text>
                <TextInput
                  value={startDate}
                  onChangeText={(t) => { setStartDate(t); if (formError) setFormError(null); }}
                  placeholder="2026-09-01"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  maxLength={10}
                  accessibilityLabel="First day off"
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Last day (leave blank for one day)</Text>
                <TextInput
                  value={endDate}
                  onChangeText={(t) => { setEndDate(t); if (formError) setFormError(null); }}
                  placeholder="2026-09-03"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  maxLength={10}
                  accessibilityLabel="Last day off"
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Reason (optional)</Text>
                <TextInput
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Family commitment"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  maxLength={500}
                  accessibilityLabel="Reason for time off"
                />
              </View>
              {formError ? <Text style={styles.formError}>{formError}</Text> : null}
              <Pressable
                onPress={() => void submitTimeOff()}
                disabled={submitting}
                style={({ pressed }) => [styles.primaryBtn, pressed && !submitting && { opacity: 0.9 }]}
                accessibilityRole="button"
                accessibilityLabel="Send time off request"
              >
                {submitting ? (
                  <ActivityIndicator color={colors.onGradient} />
                ) : (
                  <Text style={styles.primaryBtnText}>Send request</Text>
                )}
              </Pressable>
            </View>

            <Text style={styles.sectionLabel}>My requests</Text>
            {requests.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="calendar-outline" size={26} color={colors.textMuted} />
                <Text style={styles.emptyText}>No time off requested yet.</Text>
              </View>
            ) : (
              requests.map((req, index) => {
                const meta = STATUS_META[req.status];
                const days = dayCount(req.startDate, req.endDate);
                return (
                  <Animated.View
                    key={req.id}
                    entering={FadeInDown.delay(Math.min(index, 8) * 50).duration(280)}
                    style={styles.requestCard}
                  >
                    <View style={styles.requestTop}>
                      <Text style={styles.requestDates}>
                        {formatDateRange(req.startDate, req.endDate)}
                      </Text>
                      <View style={[styles.statusPill, { backgroundColor: `${meta.color}${alpha.tint}` }]}>
                        <Ionicons name={meta.icon} size={13} color={meta.color} />
                        <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                      </View>
                    </View>
                    <Text style={styles.requestDays}>
                      {days} {days === 1 ? 'day' : 'days'}
                    </Text>
                    {req.reason ? (
                      <Text style={styles.requestReason} numberOfLines={2}>{req.reason}</Text>
                    ) : null}
                    {req.reviewNote ? (
                      <Text style={styles.reviewNote}>{req.reviewNote}</Text>
                    ) : null}
                    {req.status === 'requested' || req.status === 'approved' ? (
                      <Pressable
                        onPress={() => cancelRequest(req)}
                        hitSlop={8}
                        style={styles.cancelBtn}
                        accessibilityRole="button"
                        accessibilityLabel="Cancel this time off request"
                      >
                        <Text style={styles.cancelText}>Cancel request</Text>
                      </Pressable>
                    ) : null}
                  </Animated.View>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBg },
  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 48, gap: 12 },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.lg,
    padding: 16,
    gap: 10,
    ...shadow.card,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  cardHint: { ...typography.caption, color: colors.textSecondary, lineHeight: 16 },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    gap: 8,
  },
  dayLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, width: 34 },
  dayOff: { ...typography.caption, color: colors.textMuted },
  timeInputs: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
    color: colors.textPrimary,
    backgroundColor: colors.screenBg,
    width: 66,
    textAlign: 'center',
  },
  timeDash: { ...typography.caption, color: colors.textMuted },
  field: { gap: 5 },
  fieldLabel: { ...typography.caption, color: colors.textSecondary },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.screenBg,
  },
  formError: { ...typography.caption, color: colors.danger },
  primaryBtn: {
    backgroundColor: colors.brandBlue,
    borderRadius: radii.md,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 2,
  },
  primaryBtnText: { color: colors.onGradient, fontWeight: '700', fontSize: 15 },
  sectionLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  emptyCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.lg,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    ...shadow.card,
  },
  emptyText: { ...typography.caption, color: colors.textSecondary },
  requestCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.lg,
    padding: 14,
    gap: 4,
    ...shadow.card,
  },
  requestTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  requestDates: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  requestDays: { ...typography.caption, color: colors.textMuted },
  requestReason: { fontSize: 13, color: colors.textSecondary },
  reviewNote: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  statusText: { ...typography.caption },
  cancelBtn: { alignSelf: 'flex-start', marginTop: 6 },
  cancelText: { ...typography.caption, color: colors.brandBlue, fontWeight: '700' },
});
