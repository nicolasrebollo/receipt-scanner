import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  EmptyState,
  Icon,
  ModalHeader,
  Screen,
  Segmented,
  Separator,
} from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import {
  deleteConversation,
  deleteMemory,
  listConversations,
  listMemories,
  type Conversation,
  type Memory,
} from '@/lib/chat';
import { formatShort, toISODate, today } from '@/lib/dates';
import { confirmAction, showMessage } from '@/lib/dialogs';
import { useHousehold } from '@/providers/app-provider';
import { useChat } from '@/providers/chat-provider';

type Tab = 'chats' | 'memory';

function whenLabel(updatedAt: string): string {
  const day = toISODate(new Date(updatedAt));
  if (day === today()) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (day === toISODate(yesterday)) return 'Yesterday';
  return formatShort(day);
}

export default function ChatHistoryScreen() {
  const theme = useTheme();
  const { household } = useHousehold();
  const { active, open, startNew } = useChat();
  const [tab, setTab] = useState<Tab>('chats');
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [memories, setMemories] = useState<Memory[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!household.id) return;
    let cancelled = false;
    Promise.all([listConversations(household.id), listMemories(household.id)]).then(
      ([c, m]) => {
        if (cancelled) return;
        setConversations(c);
        setMemories(m);
      },
      () => !cancelled && setFailed(true),
    );
    return () => {
      cancelled = true;
    };
  }, [household.id]);

  const removeConversation = async (conversation: Conversation) => {
    const confirmed = await confirmAction({
      title: 'Delete this chat?',
      message: `“${conversation.title}” will be deleted for good.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await deleteConversation(conversation.id);
      setConversations((list) => list?.filter((c) => c.id !== conversation.id) ?? null);
      if (active?.id === conversation.id) startNew();
    } catch {
      showMessage('Couldn’t delete', 'Check your connection and try again.');
    }
  };

  const removeMemory = async (memory: Memory) => {
    try {
      await deleteMemory(memory.id);
      setMemories((list) => list?.filter((m) => m.id !== memory.id) ?? null);
    } catch {
      showMessage('Couldn’t remove', 'Check your connection and try again.');
    }
  };

  const loading = !failed && (conversations === null || memories === null);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ModalHeader title="Chats" cancelLabel="Done" onCancel={() => router.back()} />
      <Screen>
        <Segmented
          options={[
            { value: 'chats', label: 'Conversations' },
            { value: 'memory', label: 'Memory' },
          ]}
          value={tab}
          onChange={setTab}
        />

        {failed ? (
          <EmptyState
            icon="wifi.exclamationmark"
            title="Couldn’t load"
            message="Check your connection and reopen this screen."
          />
        ) : loading ? (
          <ActivityIndicator style={{ marginTop: Spacing.xl }} />
        ) : tab === 'chats' ? (
          <>
            <Button
              title="New chat"
              icon="square.and.pencil"
              variant="secondary"
              onPress={() => {
                startNew();
                router.back();
              }}
            />
            {conversations!.length === 0 ? (
              <EmptyState
                icon="bubble.left.and.bubble.right"
                title="No chats yet"
                message="Your conversations with the assistant will be listed here. Only you can see them."
              />
            ) : (
              <Card style={styles.list}>
                {conversations!.map((c, i) => (
                  <View key={c.id}>
                    {i > 0 ? <Separator /> : null}
                    <View style={styles.row}>
                      <Pressable
                        accessibilityRole="button"
                        style={({ pressed }) => [styles.rowMain, { opacity: pressed ? 0.6 : 1 }]}
                        onPress={() => {
                          open({ id: c.id, title: c.title });
                          router.back();
                        }}>
                        <AppText
                          variant="body"
                          numberOfLines={1}
                          style={c.id === active?.id ? { fontWeight: '600' } : undefined}>
                          {c.title}
                        </AppText>
                        <AppText variant="footnote" tone="secondary">
                          {whenLabel(c.updated_at)}
                        </AppText>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Delete chat: ${c.title}`}
                        hitSlop={10}
                        onPress={() => removeConversation(c)}>
                        <Icon name="trash" size={17} color={theme.textMuted} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </Card>
            )}
          </>
        ) : (
          <>
            <AppText variant="subhead" tone="secondary">
              Things you’ve asked the assistant to remember. It uses them in every chat. To add one, tell it
              something like “Remember our grocery budget is $600 a month.”
            </AppText>
            {memories!.length === 0 ? (
              <EmptyState icon="sparkles" title="Nothing remembered yet" />
            ) : (
              <Card style={styles.list}>
                {memories!.map((m, i) => (
                  <View key={m.id}>
                    {i > 0 ? <Separator /> : null}
                    <View style={styles.row}>
                      <AppText variant="body" style={styles.rowMain}>
                        {m.content}
                      </AppText>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Forget: ${m.content}`}
                        hitSlop={10}
                        onPress={() => removeMemory(m)}>
                        <Icon name="xmark" size={15} color={theme.textMuted} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </Card>
            )}
          </>
        )}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: Spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 12 },
  rowMain: { flex: 1, gap: 2 },
});
