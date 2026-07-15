import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import ScreenHeader from '../common/ScreenHeader';
import { colors, typography, radii, shadow, alpha } from '../common/tokens';

const SERVICE_LABELS: Record<string, string> = {
  T1019: 'Personal Care',
  S5125: 'Attendant Care',
  T1004: 'Home Health Aide',
  T1021: 'Home Health Aide Visit',
};

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v || undefined;
}

function fmtDate(iso?: string): string {
  if (!iso) return ', ';
  const d = new Date(iso);
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : ', ';
}

function fmtTime(iso?: string): string {
  if (!iso) return ', ';
  const d = new Date(iso);
  return Number.isFinite(d.getTime())
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
    : ', ';
}

function fmtDuration(inIso?: string, outIso?: string): string {
  if (!inIso || !outIso) return ', ';
  const ms = new Date(outIso).getTime() - new Date(inIso).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return ', ';
  const min = Math.round(ms / 60000);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function VisitDetailScreen() {
  const params = useLocalSearchParams();

  const clientName = one(params.clientName) ?? 'Client';
  const clockInTime = one(params.clockInTime);
  const clockOutTime = one(params.clockOutTime);
  const status = (one(params.status) ?? 'pending') as 'verified' | 'flagged' | 'pending';
  const serviceCode = one(params.serviceCode);
  const flagReason = one(params.flagReason);
  const visitNote = one(params.visitNote);
  // Tasks arrive JSON-stringified through router params; a malformed value
  // degrades to "no documentation" rather than crashing the screen.
  const tasks: { id: string; duty: string }[] = (() => {
    const raw = one(params.tasks);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((t) => t && typeof t.duty === 'string') : [];
    } catch {
      return [];
    }
  })();

  const inProgress = !clockOutTime;
  const meta =
    status === 'verified'
      ? { color: colors.success, label: 'Verified', icon: 'shield-checkmark' as const, sub: 'GPS confirmed at clock-in and clock-out.' }
      : status === 'flagged'
      ? { color: colors.amber, label: 'Flagged', icon: 'alert-circle' as const, sub: 'This visit needs a coordinator review.' }
      : inProgress
      ? { color: colors.brandBlue, label: 'In progress', icon: 'time' as const, sub: 'This visit is currently underway.' }
      : { color: colors.slate, label: 'Pending', icon: 'ellipse' as const, sub: 'Awaiting verification.' };

  const service = serviceCode ? SERVICE_LABELS[serviceCode] ?? serviceCode : 'Visit';

  return (
    <View style={styles.container}>
      <ScreenHeader title="Visit details" />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Status hero */}
        <View style={styles.heroCard}>
          <View style={[styles.heroIcon, { backgroundColor: `${meta.color}${alpha.tint}` }]}>
            <Ionicons name={meta.icon} size={28} color={meta.color} />
          </View>
          <Text style={styles.heroClient}>{clientName}</Text>
          <View style={[styles.heroPill, { backgroundColor: `${meta.color}${alpha.tint}` }]}>
            <Text style={[styles.heroPillText, { color: meta.color }]}>{meta.label}</Text>
          </View>
          <Text style={styles.heroSub}>{meta.sub}</Text>
        </View>

        {/* Flag explanation */}
        {status === 'flagged' ? (
          <View style={styles.flagCard}>
            <View style={styles.flagHead}>
              <Ionicons name="alert-circle" size={18} color={colors.amberDark} />
              <Text style={styles.flagTitle}>Why was this flagged?</Text>
            </View>
            <Text style={styles.flagBody}>
              {flagReason ??
                'A specific reason will appear here once this visit finishes syncing with the office. Common reasons include a late clock-in, clocking out away from the client, or low GPS accuracy.'}
            </Text>
            <Text style={styles.flagNote}>Your coordinator may follow up. No action is needed from you right now.</Text>
          </View>
        ) : null}

        {/* Details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Visit summary</Text>
          <Row label="Date" value={fmtDate(clockInTime)} />
          <Row label="Clock in" value={fmtTime(clockInTime)} />
          <Row label="Clock out" value={inProgress ? 'In progress' : fmtTime(clockOutTime)} />
          <Row label="Duration" value={fmtDuration(clockInTime, clockOutTime)} />
          <Row label="Service" value={service} />
        </View>

        {/* Care documented at clock-out */}
        {tasks.length > 0 || visitNote ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Care documented</Text>
            {tasks.length > 0 ? (
              <View style={styles.taskChips}>
                {tasks.map((t) => (
                  <View key={t.id} style={styles.taskChip}>
                    <Ionicons name="checkmark" size={12} color={colors.brandBlue} />
                    <Text style={styles.taskChipText}>{t.duty}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {visitNote ? (
              <View style={[styles.noteBox, tasks.length > 0 && { marginTop: 12 }]}>
                <Text style={styles.noteLabel}>Visit note</Text>
                <Text style={styles.noteText}>{visitNote}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.evvNote}>
          <Ionicons name="lock-closed" size={13} color={colors.textMuted} style={{ marginTop: 1 }} />
          <Text style={styles.evvNoteText}>
            Clock-in and clock-out GPS are recorded for PA EVV compliance and cannot be edited from the app.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },
  scroll: { padding: 16, paddingBottom: 40, gap: 14 },

  heroCard: {
    backgroundColor: colors.cardBg, borderRadius: radii.xl, padding: 22, alignItems: 'center',
    ...shadow.card,
  },
  heroIcon: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  heroClient: { fontSize: 20, fontWeight: '900', color: colors.textPrimary, textAlign: 'center' },
  heroPill: { marginTop: 10, borderRadius: radii.pill, paddingHorizontal: 14, paddingVertical: 6 },
  heroPillText: { ...typography.sub, fontWeight: '800' },
  heroSub: { ...typography.sub, color: colors.textSecondary, textAlign: 'center', marginTop: 10, lineHeight: 18 },

  flagCard: {
    backgroundColor: colors.amberBg, borderRadius: radii.lg, padding: 16,
    borderWidth: 1, borderColor: colors.amberBorder,
  },
  flagHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  flagTitle: { ...typography.body, fontWeight: '900', color: colors.amberDark },
  flagBody: { fontSize: 14, color: colors.amberDark, lineHeight: 20, fontWeight: '600' },
  flagNote: { fontSize: 12, color: colors.amberDark, lineHeight: 17, marginTop: 10 },

  card: {
    backgroundColor: colors.cardBg, borderRadius: radii.lg, padding: 18,
    ...shadow.card,
  },
  cardTitle: { fontSize: 14, fontWeight: '900', color: colors.textPrimary, marginBottom: 12 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  rowLabel: { ...typography.sub, fontWeight: '600', color: colors.textSecondary },
  rowValue: { fontSize: 14, color: colors.textPrimary, fontWeight: '800' },

  taskChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  taskChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#f0f6fd', borderRadius: radii.pill,
    paddingHorizontal: 11, paddingVertical: 6,
    borderWidth: 1, borderColor: '#e0ecf8',
  },
  taskChipText: { fontSize: 12, fontWeight: '700', color: colors.brandBlue },
  noteBox: {
    backgroundColor: colors.inputBg, borderRadius: radii.md, padding: 13,
    borderWidth: 1, borderColor: colors.inputBorder,
  },
  noteLabel: { ...typography.label, fontSize: 10, letterSpacing: 0.6, color: colors.textMuted, marginBottom: 5 },
  noteText: { fontSize: 13.5, color: colors.textPrimary, lineHeight: 20, fontWeight: '500' },

  evvNote: {
    flexDirection: 'row', gap: 9, alignItems: 'flex-start',
    backgroundColor: colors.cardBg, borderRadius: radii.md, padding: 14,
    ...shadow.subtle,
  },
  evvNoteText: { flex: 1, color: colors.textMuted, fontSize: 12, lineHeight: 18 },
});
