import { router, type Href } from 'expo-router';
import { useEffect } from 'react';

import { initialNotificationPath, onNotificationOpened } from '@/lib/push';

/** Opens the screen a tapped notification points at ("/receipt/<id>", "/insights?month=…"). */
export function useNotificationLinks() {
  useEffect(() => {
    const open = (path: string) => router.push(path as Href);
    const initial = initialNotificationPath();
    if (initial) open(initial);
    return onNotificationOpened(open);
  }, []);
}
