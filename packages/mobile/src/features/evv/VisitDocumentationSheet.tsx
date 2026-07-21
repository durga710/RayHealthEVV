import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import apiClient from '../../lib/api-client';
import SignaturePad, { type SignatureStrokes } from './SignaturePad';
import { colors, typography, radii, shadow, gradients } from '../common/tokens';

interface PATask {
  id: string;
  duty: string;
}

/** Matches the clock-out API's signature payload (evvSignatureInputSchema). */
export interface VisitSignatureInput {
  strokes: SignatureStrokes;
  width: number;
  height: number;
  signerRole: 'client' | 'representative';
  signerName?: string;
}

type SignerRole = VisitSignatureInput['signerRole'];

/**
 * Pre-clock-out documentation sheet, two steps:
 *   1. tasks performed (PA task catalog) + note for the office
 *   2. verification-of-service signature from the client or a representative
 *
 * Everything is deliberately optional, a caregiver must ALWAYS be able to end
 * their shift: the submit button never gates on selection or signature, and a
 * failed catalog fetch degrades to note-only capture instead of blocking
 * clock-out. State lives in this component and survives hide/show because the
 * parent keeps the sheet mounted and toggles `visible`.
 */
export default function VisitDocumentationSheet({
  visible,
  clientName,
  submitting,
  onCancel,
  onSubmit,
}: {
  visible: boolean;
  clientName?: string;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (taskIds: string[], note: string, signature?: VisitSignatureInput) => void;
}) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'tasks' | 'sign'>('tasks');
  const [tasks, setTasks] = useState<PATask[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [note, setNote] = useState('');
  // AI polish: a server-drafted rewrite of the caregiver's rough note. The
  // draft NEVER auto-applies — it sits in a review card until the caregiver
  // taps "Use draft" (note stays editable after) or "Keep mine". The note is
  // only persisted at clock-out, so accepting a draft is always followed by
  // an explicit human submit.
  const [aiDraft, setAiDraft] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [strokes, setStrokes] = useState<SignatureStrokes>([]);
  const [padSize, setPadSize] = useState<{ width: number; height: number } | null>(null);
  const [signerRole, setSignerRole] = useState<SignerRole>('client');
  const [signerName, setSignerName] = useState('');

  const loadTasks = useCallback(async () => {
    setLoadFailed(false);
    try {
      const { data } = await apiClient.get<PATask[]>('/api/tasks');
      setTasks(data);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    if (visible && tasks === null && !loadFailed) void loadTasks();
  }, [visible, tasks, loadFailed, loadTasks]);

  const filtered = useMemo(() => {
    if (!tasks) return [];
    const q = search.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((t) => t.duty.toLowerCase().includes(q));
  }, [tasks, search]);

  const toggle = (id: string) => {
    void Haptics.selectionAsync();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const count = selected.size;
  const hasSignature = strokes.length > 0 && padSize !== null;

  // Ask the server for an AI rewrite of the rough note. Failure is always
  // soft: the caregiver's own wording stays in the input and clock-out is
  // never blocked (matches the sheet's "everything is optional" contract).
  const polishNote = async () => {
    const rough = note.trim();
    if (!rough || aiBusy) return;
    void Haptics.selectionAsync();
    setAiBusy(true);
    setAiError(null);
    try {
      const duties = tasks ? tasks.filter((t) => selected.has(t.id)).map((t) => t.duty) : [];
      const { data } = await apiClient.post<{ draft?: string }>('/api/evv/draft-note', {
        roughNote: rough,
        ...(duties.length > 0 ? { taskDuties: duties } : {}),
        ...(clientName ? { clientName } : {}),
      });
      if (data.draft && data.draft.trim()) {
        setAiDraft(data.draft.trim());
      } else {
        setAiError("Couldn't draft a suggestion — your note is fine as written.");
      }
    } catch {
      setAiError("AI polish isn't available right now — your note will be saved as written.");
    } finally {
      setAiBusy(false);
    }
  };

  const acceptDraft = () => {
    if (!aiDraft) return;
    void Haptics.selectionAsync();
    setNote(aiDraft);
    setAiDraft(null);
  };

  const dismissDraft = () => {
    void Haptics.selectionAsync();
    setAiDraft(null);
  };

  const submit = () => {
    const signature: VisitSignatureInput | undefined = hasSignature && padSize
      ? {
          strokes,
          width: padSize.width,
          height: padSize.height,
          signerRole,
          ...(signerName.trim() ? { signerName: signerName.trim() } : {}),
        }
      : undefined;
    onSubmit([...selected], note.trim(), signature);
  };

  const renderTask = ({ item }: { item: PATask }) => {
    const isOn = selected.has(item.id);
    return (
      <Pressable
        onPress={() => toggle(item.id)}
        style={({ pressed }) => [
          styles.taskRow,
          isOn && styles.taskRowOn,
          pressed && { opacity: 0.85 },
        ]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isOn }}
        accessibilityLabel={item.duty}
      >
        <Ionicons
          name={isOn ? 'checkmark-circle' : 'ellipse-outline'}
          size={22}
          color={isOn ? colors.brandBlue : colors.chevron}
        />
        <Text style={[styles.taskText, isOn && styles.taskTextOn]}>{item.duty}</Text>
      </Pressable>
    );
  };

  const headerSubtitle =
    step === 'tasks'
      ? `${clientName ? `${clientName} · ` : ''}check off what you did today`
      : `${clientName ? `${clientName} · ` : ''}confirm the visit with a signature`;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={step === 'sign' ? () => setStep('tasks') : onCancel}
      presentationStyle="pageSheet"
    >
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 18 : insets.top + 12 }]}>
          {step === 'sign' ? (
            <Pressable
              onPress={() => setStep('tasks')}
              hitSlop={12}
              style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel="Back to tasks"
            >
              <Ionicons name="chevron-back" size={22} color={colors.textSecondary} />
            </Pressable>
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{step === 'tasks' ? 'Document your visit' : 'Client signature'}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>{headerSubtitle}</Text>
          </View>
          <Pressable
            onPress={onCancel}
            hitSlop={12}
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel="Back to visit"
          >
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Step dots */}
        <View style={styles.stepsRow}>
          <View style={[styles.stepDot, styles.stepDotOn]} />
          <View style={[styles.stepBar, step === 'sign' && styles.stepDotOn]} />
          <View style={[styles.stepDot, step === 'sign' && styles.stepDotOn]} />
        </View>

        {step === 'tasks' ? (
          <>
            {/* Task list (or its loading/error states) */}
            {tasks === null && !loadFailed ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="small" color={colors.brandBlue} />
                <Text style={styles.centerText}>Loading task list…</Text>
              </View>
            ) : loadFailed ? (
              <View style={styles.centerBox}>
                <Ionicons name="cloud-offline-outline" size={26} color={colors.textMuted} />
                <Text style={styles.centerText}>
                  {"Couldn't load the task list. You can still add a note, collect a signature, and clock out."}
                </Text>
                <Pressable
                  onPress={() => void loadTasks()}
                  style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.85 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading tasks"
                >
                  <Text style={styles.retryBtnText}>Retry</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.searchWrap}>
                  <Ionicons name="search" size={16} color={colors.placeholder} />
                  <TextInput
                    style={styles.searchInput}
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search tasks (bathing, meals…)"
                    placeholderTextColor={colors.placeholder}
                    autoCorrect={false}
                    accessibilityLabel="Search tasks"
                  />
                  {search.length > 0 ? (
                    <Pressable onPress={() => setSearch('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
                      <Ionicons name="close-circle" size={16} color={colors.chevron} />
                    </Pressable>
                  ) : null}
                </View>
                <FlatList
                  data={filtered}
                  keyExtractor={(t) => t.id}
                  renderItem={renderTask}
                  style={styles.list}
                  contentContainerStyle={styles.listContent}
                  keyboardShouldPersistTaps="handled"
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>No tasks match “{search.trim()}”.</Text>
                  }
                />
              </>
            )}

            {/* Note + next */}
            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={(next) => {
                  setNote(next);
                  if (aiError) setAiError(null);
                }}
                placeholder="Add a note for the office (optional)"
                placeholderTextColor={colors.placeholder}
                multiline
                maxLength={2000}
                accessibilityLabel="Visit note"
              />
              {aiDraft ? (
                <View style={styles.aiCard}>
                  <View style={styles.aiCardHeader}>
                    <Ionicons name="sparkles" size={14} color={colors.brandBlue} />
                    <Text style={styles.aiCardLabel}>AI suggestion · review before using</Text>
                  </View>
                  <Text style={styles.aiDraftText}>{aiDraft}</Text>
                  <View style={styles.aiCardActions}>
                    <Pressable
                      onPress={acceptDraft}
                      style={({ pressed }) => [styles.aiUseBtn, pressed && { opacity: 0.85 }]}
                      accessibilityRole="button"
                      accessibilityLabel="Use the AI draft as my note"
                    >
                      <Text style={styles.aiUseBtnText}>Use draft</Text>
                    </Pressable>
                    <Pressable
                      onPress={dismissDraft}
                      style={({ pressed }) => [styles.aiKeepBtn, pressed && { opacity: 0.85 }]}
                      accessibilityRole="button"
                      accessibilityLabel="Keep my own note"
                    >
                      <Text style={styles.aiKeepBtnText}>Keep mine</Text>
                    </Pressable>
                  </View>
                </View>
              ) : note.trim().length >= 12 ? (
                <Pressable
                  onPress={() => void polishNote()}
                  disabled={aiBusy}
                  style={({ pressed }) => [styles.aiPolishBtn, pressed && !aiBusy && { opacity: 0.8 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Tidy this note with AI"
                >
                  {aiBusy ? (
                    <ActivityIndicator size="small" color={colors.brandBlue} />
                  ) : (
                    <Ionicons name="sparkles" size={15} color={colors.brandBlue} />
                  )}
                  <Text style={styles.aiPolishText}>
                    {aiBusy ? 'Tidying your note…' : 'Tidy with AI'}
                  </Text>
                </Pressable>
              ) : null}
              {aiError ? <Text style={styles.aiErrorText}>{aiError}</Text> : null}
              <Pressable
                onPress={() => {
                  void Haptics.selectionAsync();
                  setStep('sign');
                }}
                disabled={submitting}
                style={({ pressed }) => [
                  styles.submitWrap,
                  pressed && !submitting && { transform: [{ scale: 0.98 }], opacity: 0.95 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Continue to client signature"
              >
                <LinearGradient
                  colors={gradients.cta}
                  style={styles.submitBtn}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.submitText}>
                    {count > 0 ? `Next · ${count} task${count === 1 ? '' : 's'} selected` : 'Next · Client signature'}
                  </Text>
                  <Ionicons name="arrow-forward" size={19} color={colors.onGradient} />
                </LinearGradient>
              </Pressable>
              <Text style={styles.footNote}>
                Tasks and your note are saved with this visit&apos;s EVV record.
              </Text>
            </View>
          </>
        ) : (
          <>
            {/* Signature step */}
            <View style={styles.signBody}>
              <View style={styles.signerRow}>
                {(
                  [
                    { role: 'client' as const, label: 'Client' },
                    { role: 'representative' as const, label: 'Family / representative' },
                  ]
                ).map(({ role, label }) => {
                  const isOn = signerRole === role;
                  return (
                    <Pressable
                      key={role}
                      onPress={() => {
                        void Haptics.selectionAsync();
                        setSignerRole(role);
                      }}
                      style={({ pressed }) => [styles.signerChip, isOn && styles.signerChipOn, pressed && { opacity: 0.85 }]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isOn }}
                      accessibilityLabel={`Signer: ${label}`}
                    >
                      <Text style={[styles.signerChipText, isOn && styles.signerChipTextOn]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <SignaturePad
                strokes={strokes}
                onChange={(next, size) => {
                  setStrokes(next);
                  setPadSize(size);
                }}
              />

              <TextInput
                style={styles.nameInput}
                value={signerName}
                onChangeText={setSignerName}
                placeholder="Printed name (optional)"
                placeholderTextColor={colors.placeholder}
                maxLength={120}
                autoCorrect={false}
                accessibilityLabel="Signer printed name"
              />
            </View>

            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
              <Pressable
                onPress={submit}
                disabled={submitting}
                style={({ pressed }) => [
                  styles.submitWrap,
                  pressed && !submitting && { transform: [{ scale: 0.98 }], opacity: 0.95 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Clock out"
              >
                <LinearGradient
                  colors={submitting ? ['#86b89a', '#70a080'] : gradients.ctaSuccess}
                  style={styles.submitBtn}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={colors.onGradient} />
                  ) : (
                    <Ionicons name="checkmark-circle" size={21} color={colors.onGradient} />
                  )}
                  <Text style={styles.submitText}>
                    {submitting ? 'Clocking out…' : hasSignature ? 'Clock Out · Signed' : 'Clock Out'}
                  </Text>
                </LinearGradient>
              </Pressable>
              <Text style={styles.footNote}>
                The signature is optional. If the client is unable to sign, just clock out.
              </Text>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screenBg },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingBottom: 12,
    backgroundColor: colors.cardBg,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  title: { ...typography.heading, fontSize: 19, fontWeight: '900', color: colors.textPrimary },
  subtitle: { ...typography.sub, color: colors.textSecondary, marginTop: 2 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.pressedBg, justifyContent: 'center', alignItems: 'center',
  },

  stepsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10,
  },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.chevron },
  stepBar: { width: 26, height: 3, borderRadius: 2, backgroundColor: colors.chevron },
  stepDotOn: { backgroundColor: colors.brandBlue },

  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, padding: 28 },
  centerText: { ...typography.sub, color: colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  retryBtn: {
    marginTop: 4, backgroundColor: colors.brandBlue, borderRadius: radii.sm,
    paddingHorizontal: 18, paddingVertical: 9,
  },
  retryBtnText: { ...typography.sub, fontWeight: '800', color: colors.onGradient },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder,
    borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 10 : 2,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.inputText },

  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  emptyText: { ...typography.sub, color: colors.textMuted, textAlign: 'center', marginTop: 24 },

  taskRow: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    backgroundColor: colors.cardBg, borderRadius: radii.md,
    paddingHorizontal: 14, paddingVertical: 13,
    borderWidth: 1, borderColor: colors.border,
    ...shadow.subtle,
  },
  taskRowOn: { borderColor: colors.brandBlue, backgroundColor: '#f0f6fd' },
  taskText: { flex: 1, fontSize: 14.5, fontWeight: '600', color: colors.textSecondary },
  taskTextOn: { color: colors.brandBlue, fontWeight: '800' },

  signBody: { flex: 1, paddingHorizontal: 16, paddingTop: 4, gap: 14 },
  signerRow: { flexDirection: 'row', gap: 8 },
  signerChip: {
    flex: 1, alignItems: 'center',
    backgroundColor: colors.cardBg, borderRadius: radii.pill,
    paddingVertical: 10, paddingHorizontal: 10,
    borderWidth: 1.5, borderColor: colors.border,
  },
  signerChipOn: { borderColor: colors.brandBlue, backgroundColor: '#f0f6fd' },
  signerChipText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  signerChipTextOn: { color: colors.brandBlue, fontWeight: '800' },
  nameInput: {
    backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder,
    borderRadius: radii.md, paddingHorizontal: 13, paddingVertical: Platform.OS === 'ios' ? 12 : 9,
    fontSize: 14, color: colors.inputText,
  },

  footer: {
    backgroundColor: colors.cardBg, paddingHorizontal: 16, paddingTop: 12, gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  noteInput: {
    backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder,
    borderRadius: radii.md, paddingHorizontal: 13, paddingTop: 10, paddingBottom: 10,
    fontSize: 14, color: colors.inputText, minHeight: 64, maxHeight: 120,
    textAlignVertical: 'top',
  },
  // AI polish
  aiPolishBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.cardBg,
  },
  aiPolishText: { fontSize: 12.5, fontWeight: '700', color: colors.brandBlue },
  aiErrorText: { ...typography.caption, color: colors.textMuted },
  aiCard: {
    borderWidth: 1, borderColor: colors.brandBlue, borderRadius: radii.md,
    backgroundColor: '#f0f6fd', padding: 12, gap: 8,
  },
  aiCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  aiCardLabel: { fontSize: 11.5, fontWeight: '800', color: colors.brandBlue, letterSpacing: 0.2 },
  aiDraftText: { fontSize: 13.5, lineHeight: 19, color: colors.textPrimary },
  aiCardActions: { flexDirection: 'row', gap: 8 },
  aiUseBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 9,
    borderRadius: radii.sm, backgroundColor: colors.brandBlue,
  },
  aiUseBtnText: { fontSize: 13, fontWeight: '800', color: colors.onGradient },
  aiKeepBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 9,
    borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardBg,
  },
  aiKeepBtnText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  submitWrap: { borderRadius: radii.lg },
  submitBtn: {
    borderRadius: radii.lg, height: 56,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 9,
    shadowColor: colors.successDark, shadowOpacity: 0.22, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  submitText: { color: colors.onGradient, fontSize: 16.5, fontWeight: '800', letterSpacing: 0.2 },
  footNote: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
});
