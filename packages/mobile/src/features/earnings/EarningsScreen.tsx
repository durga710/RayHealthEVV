import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import apiClient from '../../lib/api-client';
import ScreenHeader from '../common/ScreenHeader';
import ErrorRetry from '../common/ErrorRetry';
import EmptyState from '../common/EmptyState';
import { SkeletonList } from '../common/Skeleton';
import { alpha, colors, radii, shadow, typography } from '../common/tokens';
import { periodRange, formatCents, formatHours, PERIODS, type PeriodKey } from '../../lib/earnings';

/**
 * Earnings screen.
 *
 * Shows a caregiver what their verified visits are worth for a chosen period.
 * The screen is emphatic that this is an estimate: the agency's payroll
 * provider is authoritative, and nothing here models tax withholding or
 * deductions. Overstating certainty about someone's pay is the one thing this
 * screen must not do.
 */

interface WeekLine {
  weekStart: string;
  regularMinutes: number;
  overtimeMinutes: number;
  regularCents: number;
  overtimeCents: number;
}

interface Statement {
  source: string;
  periodStart: string;
  periodEnd: string;
  payRateCents: number | null;
  visitCount: number;
  totalMinutes: number;
  totalHours: number;
  regularMinutes: number;
  overtimeMinutes: number;
  grossCents: number | null;
  weeks: WeekLine[];
  excludedVisits: number;
}

function formatWeek(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: 'UTC' })
    : iso;
}

export default function EarningsScreen() {
  const [period, setPeriod] = useState<PeriodKey>('thisWeek');
  const [statement, setStatement] = useState<Statement | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => periodRange(period, new Date()), [period]);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get<Statement>('/api/evv/earnings', {
        params: { from: range.from, to: range.to },
      });
      setStatement(res.data);
      setError(null);
    } catch {
      setError('Could not load your earnings.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range.from, range.to]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  const changePeriod = (next: PeriodKey) => {
    void Haptics.selectionAsync();
    setPeriod(next);
    setLoading(true);
  };

  const hasOvertime = (statement?.overtimeMinutes ?? 0) > 0;

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Earnings" />

      <View style={styles.periodRow}>
        {PERIODS.map((p) => {
          const active = p.key === period;
          return (
            <Pressable
              key={p.key}
              onPress={() => changePeriod(p.key)}
              style={({ pressed }) => [
                styles.periodChip,
                active && styles.periodChipActive,
                pressed && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Show earnings for ${p.label}`}
            >
              <Text style={[styles.periodText, active && styles.periodTextActive]}>{p.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.body}>
          <SkeletonList count={3} />
        </View>
      ) : error ? (
        <ErrorRetry message={error} onRetry={() => { setLoading(true); void load(); }} />
      ) : !statement || statement.visitCount === 0 ? (
        <EmptyState
          icon="cash-outline"
          title="No verified visits yet"
          message="Once your visits for this period are verified, your estimated earnings show up here."
        />
      ) : (
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
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
          <Animated.View entering={FadeInDown.duration(300)} style={styles.heroCard}>
            <Text style={styles.heroLabel}>Estimated gross</Text>
            {statement.grossCents == null ? (
              <>
                {/* No rate on file. Showing $0.00 would read as "you earned
                    nothing" rather than "we don't know your rate". */}
                <Text style={styles.heroNoRate}>Pay rate not set</Text>
                <Text style={styles.heroHint}>
                  Ask your agency to add your hourly rate and your estimate will appear here.
                </Text>
              </>
            ) : (
              <Text style={styles.heroAmount}>{formatCents(statement.grossCents)}</Text>
            )}
            <View style={styles.heroMetaRow}>
              <View style={styles.heroMeta}>
                <Text style={styles.heroMetaValue}>{formatHours(statement.totalMinutes)}</Text>
                <Text style={styles.heroMetaLabel}>Hours</Text>
              </View>
              <View style={styles.heroMetaDivider} />
              <View style={styles.heroMeta}>
                <Text style={styles.heroMetaValue}>{statement.visitCount}</Text>
                <Text style={styles.heroMetaLabel}>Visits</Text>
              </View>
              {hasOvertime ? (
                <>
                  <View style={styles.heroMetaDivider} />
                  <View style={styles.heroMeta}>
                    <Text style={[styles.heroMetaValue, { color: colors.brandBlue }]}>
                      {formatHours(statement.overtimeMinutes)}
                    </Text>
                    <Text style={styles.heroMetaLabel}>Overtime</Text>
                  </View>
                </>
              ) : null}
            </View>
          </Animated.View>

          <View style={styles.disclaimerCard}>
            <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.disclaimerText}>
              This is an estimate from your verified visits. It does not include taxes,
              deductions, or reimbursements. Your agency&apos;s payroll is the final word on what
              you are paid.
            </Text>
          </View>

          {statement.excludedVisits > 0 ? (
            <View style={styles.noticeCard}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.amber} />
              <Text style={styles.noticeText}>
                {statement.excludedVisits === 1
                  ? '1 visit is not counted yet because it is still pending review or has no clock-out.'
                  : `${statement.excludedVisits} visits are not counted yet because they are still pending review or have no clock-out.`}
              </Text>
            </View>
          ) : null}

          {statement.weeks.length > 1 || hasOvertime ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>By week</Text>
              {statement.weeks.map((w) => (
                <View key={w.weekStart} style={styles.weekRow}>
                  <Text style={styles.weekLabel}>Week of {formatWeek(w.weekStart)}</Text>
                  <View style={styles.weekRight}>
                    <Text style={styles.weekHours}>
                      {formatHours(w.regularMinutes + w.overtimeMinutes)}
                    </Text>
                    {w.overtimeMinutes > 0 ? (
                      <Text style={styles.weekOt}>{formatHours(w.overtimeMinutes)} OT</Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBg },
  periodRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 14 },
  periodChip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.cardBg,
  },
  periodChipActive: { backgroundColor: colors.brandBlue },
  periodText: { ...typography.caption, color: colors.textSecondary },
  periodTextActive: { color: colors.onGradient },
  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 48, gap: 12 },
  heroCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.lg,
    padding: 20,
    gap: 6,
    ...shadow.card,
  },
  heroLabel: { ...typography.caption, color: colors.textMuted, textTransform: 'uppercase' },
  heroAmount: { fontSize: 38, fontWeight: '800', color: colors.textPrimary },
  heroNoRate: { fontSize: 22, fontWeight: '700', color: colors.textSecondary },
  heroHint: { ...typography.caption, color: colors.textMuted, lineHeight: 16 },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 14 },
  heroMeta: { gap: 2 },
  heroMetaDivider: { width: 1, height: 26, backgroundColor: colors.border },
  heroMetaValue: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  heroMetaLabel: { ...typography.caption, color: colors.textMuted },
  disclaimerCard: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: radii.md,
    backgroundColor: `${colors.textSecondary}${alpha.tint}`,
  },
  disclaimerText: { ...typography.caption, color: colors.textSecondary, flex: 1, lineHeight: 16 },
  noticeCard: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: radii.md,
    backgroundColor: `${colors.amber}${alpha.tint}`,
  },
  noticeText: { ...typography.caption, color: colors.textPrimary, flex: 1, lineHeight: 16 },
  section: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.lg,
    padding: 16,
    gap: 10,
    ...shadow.card,
  },
  sectionTitle: { ...typography.caption, color: colors.textMuted, textTransform: 'uppercase' },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weekLabel: { fontSize: 14, color: colors.textPrimary },
  weekRight: { alignItems: 'flex-end' },
  weekHours: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  weekOt: { ...typography.caption, color: colors.brandBlue },
});
