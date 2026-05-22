import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../../lib/api-client';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export default function CopilotScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hello! I am your **RayHealth AI Copilot**. I can help you understand and comply with Pennsylvania DHS home-care EVV regulations.\n\nAsk me about:\n📍 **Geofence Radius Bounds**\n📋 **PA Duty Tasks Attestation** (e.g. Task 106)\n📶 **Offline Action Queue & Syncing**\n🪪 **Annual Credential Safeguards**\n\nHow can I help you today?",
      timestamp: new Date().toISOString()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Auto-scroll list when new messages arrive
  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userMessageContent = inputText;
    setInputText('');

    const newUserMessage: ChatMessage = {
      id: Math.random().toString(),
      role: 'user',
      content: userMessageContent,
      timestamp: new Date().toISOString()
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setIsSending(true);

    try {
      // Map message history to the backend format
      const history = [...messages, newUserMessage].map((m) => ({
        role: m.role,
        content: m.content
      }));

      const { data } = await apiClient.post('/api/support/chat', { messages: history });

      if (data.success && data.reply) {
        const assistantMessage: ChatMessage = {
          id: Math.random().toString(),
          role: 'assistant',
          content: data.reply.content,
          timestamp: data.reply.timestamp || new Date().toISOString()
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        throw new Error('Invalid server response');
      }
    } catch (error) {
      console.error('Chat error', error);
      const errorMessage: ChatMessage = {
        id: Math.random().toString(),
        role: 'assistant',
        content: "Sorry, I ran into an error communicating with the support engine. Please check your network connection and try again.",
        timestamp: new Date().toISOString()
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
    }
  };

  const renderBubble = ({ item }: { item: ChatMessage }) => {
    const isAssistant = item.role === 'assistant';

    return (
      <View style={[styles.bubbleContainer, isAssistant ? styles.assistantAlign : styles.userAlign]}>
        <View style={styles.avatarRow}>
          {isAssistant && (
            <View style={styles.assistantAvatar}>
              <Ionicons name="sparkles" size={12} color="#ffffff" />
            </View>
          )}
          <View
            style={[
              styles.bubble,
              isAssistant ? styles.assistantBubble : styles.userBubble
            ]}
          >
            <Text style={[styles.bubbleText, isAssistant ? styles.assistantText : styles.userText]}>
              {item.content}
            </Text>
            <Text style={[styles.timestamp, isAssistant ? styles.assistantTimestamp : styles.userTimestamp]}>
              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1248a0" />

      {/* Embedded HUD Header banner */}
      <View style={styles.copilotHUD}>
        <Ionicons name="sparkles" size={18} color="#f97316" />
        <Text style={styles.hudTitle}>RayHealth Compliance Assistant</Text>
        <View style={styles.complianceBadge}>
          <Text style={styles.badgeText}>SECURE AI</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderBubble}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.chatList}
          showsVerticalScrollIndicator={false}
        />

        {isSending && (
          <View style={styles.typingContainer}>
            <ActivityIndicator size="small" color="#f97316" />
            <Text style={styles.typingText}>Copilot is formulating advice...</Text>
          </View>
        )}

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            placeholder="Ask about geofences, task codes, sync..."
            placeholderTextColor="#94a3b8"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <Pressable
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || isSending}
          >
            <Ionicons name="send" size={16} color="#ffffff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  copilotHUD: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1248a0',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)'
  },
  hudTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
    flex: 1
  },
  complianceBadge: {
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.3)'
  },
  badgeText: {
    color: '#f97316',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  keyboardContainer: {
    flex: 1
  },
  chatList: {
    padding: 16,
    gap: 12
  },
  bubbleContainer: {
    marginVertical: 4,
    maxWidth: '85%'
  },
  assistantAlign: {
    alignSelf: 'flex-start'
  },
  userAlign: {
    alignSelf: 'flex-end'
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6
  },
  assistantAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#1a5fa8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1
  },
  assistantBubble: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#eef2f6'
  },
  userBubble: {
    backgroundColor: '#1a5fa8',
    borderTopRightRadius: 4
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600'
  },
  assistantText: {
    color: '#1a3a5c'
  },
  userText: {
    color: '#ffffff'
  },
  timestamp: {
    fontSize: 9,
    marginTop: 4,
    alignSelf: 'flex-end'
  },
  assistantTimestamp: {
    color: '#94a3b8'
  },
  userTimestamp: {
    color: 'rgba(255,255,255,0.6)'
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8
  },
  typingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#f97316'
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#eef2f6',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 12
  },
  textInput: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 13,
    color: '#1a3a5c',
    fontWeight: '600'
  },
  sendButton: {
    backgroundColor: '#f97316',
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 2
  },
  sendButtonDisabled: {
    backgroundColor: '#cbd5e1',
    shadowOpacity: 0,
    elevation: 0
  }
});
