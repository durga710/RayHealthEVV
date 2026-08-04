import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import apiClient from '../../lib/api-client';
import ScreenHeader from '../common/ScreenHeader';
import ErrorRetry from '../common/ErrorRetry';
import { SkeletonList } from '../common/Skeleton';
import { showAppAlert } from '../common/alerts/appAlert';
import { colors, radii, shadow, typography } from '../common/tokens';

/**
 * Messages.
 *
 * One conversation between a caregiver and their agency's office. Deliberately
 * a single thread rather than per-topic: this replaces the personal text
 * thread people were already using, and making somebody pick a category on a
 * phone would just push them back to SMS.
 */

interface Message {
  id: string;
  senderType: 'staff' | 'caregiver';
  body: string;
  createdAt: string;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function MessagesScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get<{ messages: Message[] }>('/api/messages');
      setMessages(res.data?.messages ?? []);
      setError(null);
    } catch {
      setError('Could not load your messages.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      await apiClient.post('/api/messages', { body });
      setDraft('');
      void Haptics.selectionAsync();
      await load();
      // Land on the newest message, the way any chat behaves.
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    } catch {
      showAppAlert('Could not send that message', 'Please check your connection and try again.', undefined, {
        variant: 'error',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScreenHeader title="Messages" />

      {loading ? (
        <View style={styles.body}>
          <SkeletonList count={4} />
        </View>
      ) : error ? (
        <ErrorRetry message={error} onRetry={() => { setLoading(true); void load(); }} />
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="chatbubbles-outline" size={30} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptyText}>
                Send your office a message and it will appear here. Keep client details out of
                anything you would not want on a lock screen.
              </Text>
            </View>
          ) : (
            messages.map((m) => {
              const mine = m.senderType === 'caregiver';
              return (
                <View
                  key={m.id}
                  style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}
                >
                  <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                    <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{m.body}</Text>
                    <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>
                      {formatTime(m.createdAt)}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      <View style={styles.composer}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Message your office"
          placeholderTextColor={colors.textMuted}
          style={styles.composerInput}
          multiline
          maxLength={4000}
          accessibilityLabel="Message text"
        />
        <Pressable
          onPress={() => void send()}
          disabled={sending || draft.trim().length === 0}
          style={({ pressed }) => [
            styles.sendBtn,
            (sending || draft.trim().length === 0) && styles.sendBtnDisabled,
            pressed && { opacity: 0.9 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Send message"
        >
          {sending ? (
            <ActivityIndicator color={colors.onGradient} size="small" />
          ) : (
            <Ionicons name="arrow-up" size={20} color={colors.onGradient} />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBg },
  body: { flex: 1 },
  bodyContent: { padding: 16, gap: 8, paddingBottom: 20 },
  emptyCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.lg,
    padding: 26,
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    ...shadow.card,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  emptyText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 17,
  },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', borderRadius: radii.lg, paddingHorizontal: 13, paddingVertical: 9, gap: 3 },
  bubbleMine: { backgroundColor: colors.brandBlue, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: colors.cardBg, borderBottomLeftRadius: 4, ...shadow.card },
  bubbleText: { fontSize: 15, color: colors.textPrimary, lineHeight: 20 },
  bubbleTextMine: { color: colors.onGradient },
  bubbleTime: { ...typography.caption, color: colors.textMuted, alignSelf: 'flex-end' },
  bubbleTimeMine: { color: colors.onGradientSoft },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 12,
    paddingBottom: 22,
    backgroundColor: colors.cardBg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  composerInput: {
    flex: 1,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.screenBg,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brandBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.disabled },
});
