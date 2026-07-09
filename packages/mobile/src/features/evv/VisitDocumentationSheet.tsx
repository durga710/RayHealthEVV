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
import { colors, typography, radii, shadow, gradients } from '../common/tokens';

interface PATask {
  id: string;
  duty: string;
}

/**
 * Pre-clock-out documentation sheet: the caregiver checks off the tasks they
 * performed (PA task catalog) and can add a note before the visit closes.
 *
 * Documentation is deliberately optional, a caregiver must ALWAYS be able to
 * end their shift: the submit button never gates on selection, and a failed
 * catalog fetch degrades to note-only capture instead of blocking clock-out.
 * Selections live in this component's state and survive hide/show because the
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
  onSubmit: (taskIds: string[], note: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [tasks, setTasks] = useState<PATask[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [note, setNote] = useState('');

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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onCancel}
      presentationStyle="pageSheet"
    >
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 18 : insets.top + 12 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Document your visit</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {clientName ? `${clientName} · ` : ''}check off what you did today
            </Text>
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
              {"Couldn't load the task list. You can still add a note and clock out."}
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

        {/* Note + submit */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="Add a note for the office (optional)"
            placeholderTextColor={colors.placeholder}
            multiline
            maxLength={2000}
            accessibilityLabel="Visit note"
          />
          <Pressable
            onPress={() => onSubmit([...selected], note.trim())}
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
                {submitting
                  ? 'Clocking out…'
                  : count > 0
                  ? `Clock Out · ${count} task${count === 1 ? '' : 's'}`
                  : 'Clock Out'}
              </Text>
            </LinearGradient>
          </Pressable>
          <Text style={styles.footNote}>
            Tasks and your note are saved with this visit&apos;s EVV record.
          </Text>
        </View>
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

  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, padding: 28 },
  centerText: { ...typography.sub, color: colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  retryBtn: {
    marginTop: 4, backgroundColor: colors.brandBlue, borderRadius: radii.sm,
    paddingHorizontal: 18, paddingVertical: 9,
  },
  retryBtnText: { ...typography.sub, fontWeight: '800', color: colors.onGradient },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 12, marginBottom: 8,
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
