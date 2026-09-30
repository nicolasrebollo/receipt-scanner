import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { supabase } from '@/lib/supabase';
import type { Household, Member } from '@/lib/types';

type AppContextValue = {
  session: Session | null;
  /** True until we know whether the user is signed in and which household they belong to. */
  initializing: boolean;
  household: Household | null;
  members: Member[];
  refreshHousehold: () => Promise<void>;
  /** Bumps whenever receipts change (here or on a partner's phone); screens refetch on change. */
  receiptsVersion: number;
  notifyReceiptsChanged: () => void;
  memberName: (userId: string | null) => string;
};

const AppContext = createContext<AppContextValue | null>(null);

type LoadedHousehold = { userId: string; household: Household | null; members: Member[] };

async function fetchHousehold(userId: string): Promise<LoadedHousehold> {
  const { data: membership, error } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!membership) return { userId, household: null, members: [] };

  const [h, m] = await Promise.all([
    supabase
      .from('households')
      .select('id, name, currency, invite_code')
      .eq('id', membership.household_id)
      .single(),
    supabase
      .from('household_members')
      .select('user_id, display_name')
      .eq('household_id', membership.household_id)
      .order('joined_at'),
  ]);
  if (h.error) throw h.error;
  if (m.error) throw m.error;
  return { userId, household: h.data, members: m.data };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [loaded, setLoaded] = useState<LoadedHousehold | null>(null);
  const [receiptsVersion, setReceiptsVersion] = useState(0);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoaded(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  // Load the signed-in user's household, retrying quietly if the network is down.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const attempt = () =>
      fetchHousehold(userId).then(
        (result) => !cancelled && setLoaded(result),
        (e) => {
          console.warn('Loading household failed', e);
          if (!cancelled) retry = setTimeout(attempt, 3000);
        },
      );
    attempt();
    return () => {
      cancelled = true;
      clearTimeout(retry);
    };
  }, [userId]);

  const refreshHousehold = useCallback(async () => {
    if (userId) setLoaded(await fetchHousehold(userId));
  }, [userId]);

  // Ignore data left over from a previous account.
  const current = loaded && loaded.userId === userId ? loaded : null;
  const household = current?.household ?? null;
  const members = useMemo(() => current?.members ?? [], [current]);

  const notifyReceiptsChanged = useCallback(() => setReceiptsVersion((v) => v + 1), []);

  // Live updates from other household members.
  const householdId = household?.id;
  useEffect(() => {
    if (!householdId) return;
    const channel = supabase
      .channel(`receipts:${householdId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'receipts', filter: `household_id=eq.${householdId}` },
        notifyReceiptsChanged,
      )
      // Postgres can't filter delete events by column, so listen to all deletes (they carry only the id).
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'receipts' }, notifyReceiptsChanged)
      .subscribe();
    // The socket can drop while backgrounded, so refetch when the app returns.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') notifyReceiptsChanged();
    });
    return () => {
      supabase.removeChannel(channel);
      sub.remove();
    };
  }, [householdId, notifyReceiptsChanged]);

  const memberName = useCallback(
    (id: string | null) => {
      if (!id) return 'Former member';
      if (id === userId) return 'You';
      return members.find((m) => m.user_id === id)?.display_name ?? 'Former member';
    },
    [members, userId],
  );

  return (
    <AppContext.Provider
      value={{
        session,
        initializing: !sessionLoaded || (!!userId && !current),
        household,
        members,
        refreshHousehold,
        receiptsVersion,
        notifyReceiptsChanged,
        memberName,
      }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

// Stand-in for the moment between signing out / leaving and the navigator unmounting household screens.
const NO_HOUSEHOLD: Household = { id: '', name: '', currency: 'USD', invite_code: '' };

/** For screens that only render once a household exists (guarded in the root layout). */
export function useHousehold() {
  const { household, ...rest } = useApp();
  return { household: household ?? NO_HOUSEHOLD, ...rest };
}
