import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

import { useApp } from '@/providers/app-provider';

type Active = { id: string; title: string };

type ChatContextValue = {
  /** The conversation shown in the Chat tab; null is a new, unsaved chat. */
  active: Active | null;
  open: (conversation: Active) => void;
  startNew: () => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { session } = useApp();
  const userId = session?.user.id ?? null;
  const [state, setState] = useState<{ userId: string | null; active: Active | null }>({
    userId: null,
    active: null,
  });

  const open = useCallback((active: Active) => setState({ userId, active }), [userId]);
  const startNew = useCallback(() => setState({ userId, active: null }), [userId]);

  // A conversation opened by a previous account must not carry over after signing out.
  const active = state.userId === userId ? state.active : null;

  return <ChatContext.Provider value={{ active, open, startNew }}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used inside ChatProvider');
  return ctx;
}
