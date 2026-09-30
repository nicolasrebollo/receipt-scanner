import { useCallback, useEffect, useState } from 'react';

import type { CategoryId } from '@/lib/categories';
import type { DateRange } from '@/lib/dates';
import { listReceipts } from '@/lib/receipts';
import type { Receipt } from '@/lib/types';
import { useHousehold } from '@/providers/app-provider';

type Options = { range?: DateRange; search?: string; category?: CategoryId };
type Result = { receipts: Receipt[]; error: string | null };

const LOAD_ERROR = 'Couldn’t load receipts. Pull down to retry.';

export function useReceipts({ range, search, category }: Options) {
  const { household, receiptsVersion } = useHousehold();
  const [result, setResult] = useState<Result | null>(null);

  const householdId = household.id;
  const start = range?.start;
  const end = range?.end;

  const fetchRows = useCallback(
    () =>
      listReceipts({
        householdId,
        range: start && end ? { start, end } : undefined,
        search,
        category,
      }),
    [householdId, start, end, search, category],
  );

  const onError = useCallback((e: unknown) => {
    console.warn('Loading receipts failed', e);
    setResult((prev) => ({ receipts: prev?.receipts ?? [], error: LOAD_ERROR }));
  }, []);

  useEffect(() => {
    if (!householdId) return;
    let cancelled = false; // ignore responses for a query that has since changed
    fetchRows().then(
      (receipts) => !cancelled && setResult({ receipts, error: null }),
      (e) => !cancelled && onError(e),
    );
    return () => {
      cancelled = true;
    };
  }, [householdId, fetchRows, onError, receiptsVersion]);

  const reload = useCallback(
    () => fetchRows().then((receipts) => setResult({ receipts, error: null }), onError),
    [fetchRows, onError],
  );

  return {
    receipts: result?.receipts ?? [],
    loading: result === null,
    error: result?.error ?? null,
    reload,
  };
}
