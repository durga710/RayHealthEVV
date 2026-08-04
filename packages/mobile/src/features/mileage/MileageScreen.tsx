import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
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
  formatMiles,
  parseMiles,
  summarize,
  todayYmd,
  type MileageEntry,
} from '../../lib/mileage';

/**
 * Mileage screen.
 *
 * Caregivers log the driving they do between clients and watch it move
 * through agency review. Approved and still-pending totals are shown
 * separately, because agencies pay on approved trips and one blended number
 * would overstate what is actually coming.
 */

const STATUS_META: Record<
  MileageEntry['status'],
  { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  submitted: { label: 'Pending review', color: colors.amber, icon: 'time-outline' },
  approved: { label: 'Approved', color: colors.success, icon: 'checkmark-circle-outline' },
  rejected: { label: 'Not approved', color: colors.danger, icon: 'close-circle-outline' },
};

function formatTripDate(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
    : ymd;
}

export default function MileageScreen() {
  const [entries, setEntries] = useState<MileageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [miles, setMiles] = useState('');
  const [purpose, setPurpose] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get<{ entries: MileageEntry[] }>('/api/mileage');
      setEntries(res.data?.entries ?? []);
      setError(null);
    } catch {
      setError('Could not load your mileage.');
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

  const totals = summarize(entries);

  const submit = async () => {
    const parsed = parseMiles(miles);
    if (!parsed.ok) {
      setFormError(parsed.error);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      await apiClient.post('/api/mileage', {
        tripDate: todayYmd(new Date()),
        miles: parsed.miles,
        ...(purpose.trim() ? { purpose: purpose.trim() } : {}),
      });
      setMiles('');
      setPurpose('');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load();
    } catch {
      showAppAlert(
        'Could not save that trip',
        'Please check your connection and try again.',
        undefined,
        { variant: 'error' },
      );
    } finally {
      setSaving(false);
    }
  };

  const withdraw = (entry: MileageEntry) => {
    showAppAlert(
      'Remove this trip?',
      `${formatMiles(entry.milesHundredths)} on ${formatTripDate(entry.tripDate)} will be deleted.`,
      [
        { text: 'Keep it' },
        {
          text: 'Remove',
          onPress: () => {
            void (async () => {
              try {
                await apiClient.delete(`/api/mileage/${entry.id}`);
                await load();
              } catch {
                showAppAlert('Could not remove that trip', 'Please try again.', undefined, {
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
      <ScreenHeader title="Mileage" />
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={colors.brandBlue}
          />
        }
      >
        <View style={styles.totalsRow}>
          <View style={[styles.totalCard, { flex: 1 }]}>
            <Text style={styles.totalValue}>{formatMiles(totals.approvedHundredths)}</Text>
            <Text style={styles.totalLabel}>Approved</Text>
          </View>
          <View style={[styles.totalCard, { flex: 1 }]}>
            <Text style={[styles.totalValue, { color: colors.amber }]}>
              {formatMiles(totals.submittedHundredths)}
            </Text>
            <Text style={styles.totalLabel}>Awaiting review</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Log today&apos;s driving</Text>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Miles</Text>
            <TextInput
              value={miles}
              onChangeText={(t) => {
                setMiles(t);
                if (formError) setFormError(null);
              }}
              placeholder="12.4"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              style={styles.input}
              accessibilityLabel="Miles driven"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Purpose (optional)</Text>
            <TextInput
              value={purpose}
              onChangeText={setPurpose}
              placeholder="Between visits"
              placeholderTextColor={colors.textMuted}
              maxLength={500}
              style={styles.input}
              accessibilityLabel="Trip purpose"
            />
          </View>
          {formError ? <Text style={styles.formError}>{formError}</Text> : null}
          <Pressable
            onPress={() => void submit()}
            disabled={saving}
            style={({ pressed }) => [styles.submitBtn, pressed && !saving && { opacity: 0.9 }]}
            accessibilityRole="button"
            accessibilityLabel="Save trip"
            accessibilityState={{ disabled: saving }}
          >
            {saving ? (
              <ActivityIndicator color={colors.onGradient} />
            ) : (
              <Text style={styles.submitText}>Save trip</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>Recent trips</Text>

        {loading ? (
          <SkeletonList count={3} />
        ) : error ? (
          <ErrorRetry message={error} onRetry={() => { setLoading(true); void load(); }} />
        ) : entries.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="car-outline" size={28} color={colors.textMuted} />
            <Text style={styles.emptyText}>
              No trips logged yet. Add the driving you do between clients and your agency will
              review it.
            </Text>
          </View>
        ) : (
          entries.map((entry, index) => {
            const meta = STATUS_META[entry.status];
            return (
              <Animated.View
                key={entry.id}
                entering={FadeInDown.delay(Math.min(index, 8) * 50).duration(280)}
                style={styles.entryCard}
              >
                <View style={styles.entryTop}>
                  <Text style={styles.entryMiles}>{formatMiles(entry.milesHundredths)}</Text>
                  <View style={[styles.statusPill, { backgroundColor: `${meta.color}${alpha.tint}` }]}>
                    <Ionicons name={meta.icon} size={13} color={meta.color} />
                    <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>
                <Text style={styles.entryDate}>{formatTripDate(entry.tripDate)}</Text>
                {entry.purpose ? (
                  <Text style={styles.entryPurpose} numberOfLines={2}>
                    {entry.purpose}
                  </Text>
                ) : null}
                {entry.status === 'rejected' && entry.reviewNote ? (
                  <Text style={styles.reviewNote}>{entry.reviewNote}</Text>
                ) : null}
                {entry.status === 'submitted' ? (
                  <Pressable
                    onPress={() => withdraw(entry)}
                    hitSlop={8}
                    style={styles.withdrawBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Remove this trip"
                  >
                    <Text style={styles.withdrawText}>Remove</Text>
                  </Pressable>
                ) : null}
              </Animated.View>
            );
          })
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBg },
  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 48, gap: 12 },
  totalsRow: { flexDirection: 'row', gap: 12 },
  totalCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.lg,
    padding: 16,
    gap: 2,
    ...shadow.card,
  },
  totalValue: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  totalLabel: { ...typography.caption, color: colors.textMuted },
  formCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.lg,
    padding: 16,
    gap: 12,
    ...shadow.card,
  },
  formTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
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
  submitBtn: {
    backgroundColor: colors.brandBlue,
    borderRadius: radii.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  submitText: { color: colors.onGradient, fontWeight: '700', fontSize: 15 },
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
    gap: 10,
    ...shadow.card,
  },
  emptyText: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', lineHeight: 17 },
  entryCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.lg,
    padding: 14,
    gap: 4,
    ...shadow.card,
  },
  entryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  entryMiles: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  statusText: { ...typography.caption },
  entryDate: { ...typography.caption, color: colors.textMuted },
  entryPurpose: { fontSize: 13, color: colors.textSecondary },
  reviewNote: { ...typography.caption, color: colors.danger, marginTop: 2 },
  withdrawBtn: { alignSelf: 'flex-start', marginTop: 6 },
  withdrawText: { ...typography.caption, color: colors.brandBlue, fontWeight: '700' },
});
