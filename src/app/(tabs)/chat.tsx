import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MarkdownText } from '@/components/markdown-text';
import { AppText, Icon, IconButton } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { getMessages, sendChatMessage, type ChatMessage } from '@/lib/chat';
import { useChat } from '@/providers/chat-provider';

const SUGGESTIONS = [
  'How much have we spent this month?',
  'What were our biggest purchases last month?',
  'Compare this month with last month by category',
  'What do we usually spend on groceries in a week?',
];

/** What is on screen: the open conversation's messages, plus whether they are still loading. */
type View_ = { id: string | null; messages: ChatMessage[]; loading: boolean };

/**
 * Height for the message box: one line, growing to five. Estimated from the text because a web
 * textarea's measured content height never shrinks below its current height.
 */
function composerHeight(text: string): number {
  const CHARS_PER_LINE = 30;
  const lines = text
    .split('\n')
    .reduce((n, line) => n + Math.max(1, Math.ceil(line.length / CHARS_PER_LINE)), 0);
  return Math.min(lines, 5) * 22 + 22;
}

let localId = 0;
const nextLocalId = () => `local-${++localId}`;

export default function ChatScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { active, open, startNew } = useChat();
  const activeId = active?.id ?? null;

  const [view, setView] = useState<View_>({ id: null, messages: [], loading: false });
  const [input, setInput] = useState('');
  // The reply being streamed, and which conversation it belongs to (null = a chat not saved yet).
  const [stream, setStream] = useState<{ conversationId: string | null; status: string | null } | null>(null);
  const [failure, setFailure] = useState<{ message: string; retry: string } | null>(null);
  const request = useRef<AbortController | null>(null);
  const streamFor = useRef<string | null>(null);
  const scroller = useRef<ScrollView>(null);

  // A different conversation was opened (from the history list or "new chat"): start from a clean slate.
  if (view.id !== activeId) {
    setView({ id: activeId, messages: [], loading: activeId !== null });
    setFailure(null);
  }

  useEffect(() => {
    if (!activeId || !view.loading) return;
    let cancelled = false;
    getMessages(activeId).then(
      (messages) =>
        !cancelled && setView((v) => (v.id === activeId ? { ...v, messages, loading: false } : v)),
      () => {
        if (cancelled) return;
        setView((v) => (v.id === activeId ? { ...v, loading: false } : v));
        setFailure({ message: 'Couldn’t load this conversation.', retry: '' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [activeId, view.loading]);

  // Opening a different conversation mid-reply stops reading the old one.
  // The server still finishes that reply and saves it.
  useEffect(() => {
    if (request.current && streamFor.current !== activeId) {
      request.current.abort();
      request.current = null;
    }
  }, [activeId]);

  // A reply for some other conversation doesn't block this one.
  const streaming = stream !== null && stream.conversationId === view.id;
  const status = streaming ? stream.status : null;

  const stop = () => {
    request.current?.abort();
    request.current = null;
    setStream(null);
  };

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || streaming) return;
    const controller = new AbortController();
    request.current = controller;
    streamFor.current = activeId;
    const live = () => !controller.signal.aborted;

    setInput('');
    setFailure(null);
    setStream({ conversationId: activeId, status: null });
    setView((v) => ({
      ...v,
      messages: [
        ...v.messages,
        { id: nextLocalId(), role: 'user', content: message },
        { id: nextLocalId(), role: 'assistant', content: '' },
      ],
    }));

    const appendToReply = (piece: string) =>
      setView((v) => {
        const last = v.messages[v.messages.length - 1];
        return { ...v, messages: [...v.messages.slice(0, -1), { ...last, content: last.content + piece }] };
      });

    try {
      await sendChatMessage({
        conversationId: activeId,
        message,
        signal: controller.signal,
        onEvent: (event) => {
          if (!live()) return;
          if (event.type === 'conversation' && !activeId) {
            // The server just created this conversation; adopt its id without reloading the screen.
            streamFor.current = event.id;
            setView((v) => ({ ...v, id: event.id }));
            setStream({ conversationId: event.id, status: null });
            open({ id: event.id, title: event.title });
          } else if (event.type === 'status') {
            setStream((s) => s && { ...s, status: event.label });
          } else if (event.type === 'delta') {
            setStream((s) => s && { ...s, status: null });
            appendToReply(event.text);
          }
        },
      });
    } catch (e) {
      if (!live()) return; // stopped on purpose, or a different conversation was opened
      // Drop the empty reply bubble; keep anything that did arrive.
      setView((v) => {
        const last = v.messages[v.messages.length - 1];
        return last?.role === 'assistant' && !last.content ? { ...v, messages: v.messages.slice(0, -1) } : v;
      });
      setFailure({ message: e instanceof Error ? e.message : 'Something went wrong.', retry: message });
    } finally {
      if (request.current === controller) {
        request.current = null;
        setStream(null);
      }
    }
  };

  const retry = () => {
    if (!failure?.retry) return;
    const text = failure.retry;
    // Remove the unanswered question from the screen; sending adds it back.
    setView((v) => {
      const last = v.messages[v.messages.length - 1];
      return last?.role === 'user' && last.content === text ? { ...v, messages: v.messages.slice(0, -1) } : v;
    });
    send(text);
  };

  const newChat = () => {
    stop();
    setInput('');
    setFailure(null);
    setView({ id: null, messages: [], loading: false });
    startNew();
  };

  const messages = view.messages;
  const lastMessage = messages[messages.length - 1];
  const waiting = streaming && lastMessage?.role === 'assistant' && !lastMessage.content;
  const canSend = input.trim().length > 0 && !streaming;

  return (
    <View style={[styles.screen, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: theme.separator }]}>
        <IconButton
          icon="line.3.horizontal"
          label="Conversations and memory"
          onPress={() => router.push('/chat-history')}
        />
        <AppText variant="headline" numberOfLines={1} style={styles.title}>
          {active?.title ?? 'New chat'}
        </AppText>
        <IconButton icon="square.and.pencil" label="New chat" onPress={newChat} />
      </View>

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 52}>
        <ScrollView
          ref={scroller}
          style={styles.body}
          contentContainerStyle={styles.messages}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}>
          {view.loading ? (
            <ActivityIndicator style={{ marginTop: Spacing.xxl }} />
          ) : messages.length === 0 ? (
            <View style={styles.empty}>
              <Icon name="sparkles" size={32} color={theme.accent} weight="regular" />
              <AppText variant="title" style={{ textAlign: 'center' }}>
                Ask about your spending
              </AppText>
              <AppText variant="subhead" tone="secondary" style={{ textAlign: 'center' }}>
                I can look through every receipt your household has saved.
              </AppText>
              <View style={styles.suggestions}>
                {SUGGESTIONS.map((s) => (
                  <Pressable
                    key={s}
                    accessibilityRole="button"
                    onPress={() => send(s)}
                    style={({ pressed }) => [
                      styles.suggestion,
                      { backgroundColor: theme.card, opacity: pressed ? 0.6 : 1 },
                    ]}>
                    <AppText variant="subhead">{s}</AppText>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            messages.map((m) =>
              m.role === 'user' ? (
                <View key={m.id} style={[styles.userBubble, { backgroundColor: theme.fill }]}>
                  <AppText variant="body" selectable>
                    {m.content}
                  </AppText>
                </View>
              ) : m.content ? (
                <MarkdownText key={m.id}>{m.content}</MarkdownText>
              ) : null,
            )
          )}

          {waiting || status ? (
            <View style={styles.status} accessibilityLiveRegion="polite">
              <ActivityIndicator size="small" />
              <AppText variant="subhead" tone="secondary">
                {status ?? 'Thinking'}…
              </AppText>
            </View>
          ) : null}

          {failure ? (
            <View style={styles.failure}>
              <AppText variant="subhead" tone="danger" style={{ flex: 1 }}>
                {failure.message}
              </AppText>
              {failure.retry ? (
                <Pressable accessibilityRole="button" onPress={retry} hitSlop={10}>
                  <AppText variant="subhead" tone="accent" style={{ fontWeight: '600' }}>
                    Try again
                  </AppText>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        <View
          style={[
            styles.composer,
            { borderTopColor: theme.separator },
            // The native tab bar floats over the screen; the web tab bar sits below it.
            Platform.OS !== 'web' && { paddingBottom: insets.bottom + 56 },
          ]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask about your spending"
            placeholderTextColor={theme.textMuted}
            multiline
            maxLength={4000}
            accessibilityLabel="Message"
            style={[
              styles.input,
              {
                color: theme.text,
                backgroundColor: theme.card,
                height: composerHeight(input),
              },
            ]}
          />
          {streaming ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Stop"
              onPress={stop}
              style={[styles.sendButton, { backgroundColor: theme.text }]}>
              <Icon name="stop.fill" size={16} color={theme.background} />
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send"
              disabled={!canSend}
              onPress={() => send(input)}
              style={[styles.sendButton, { backgroundColor: theme.accent, opacity: canSend ? 1 : 0.35 }]}>
              <Icon name="arrow.up" size={18} color={theme.accentText} weight="bold" />
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { flex: 1, textAlign: 'center' },
  messages: { padding: Spacing.lg, gap: Spacing.lg, flexGrow: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xl,
  },
  suggestions: { alignSelf: 'stretch', gap: Spacing.sm, marginTop: Spacing.lg },
  suggestion: {
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    borderRadius: 20,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
  },
  status: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  failure: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
    borderRadius: 22,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.lg,
    paddingTop: 11,
    paddingBottom: 11,
  },
  sendButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
