import { AppTabs } from '@/components/app-tabs';
import { useNotificationLinks } from '@/hooks/use-notification-links';

export default function TabsLayout() {
  useNotificationLinks();
  return <AppTabs />;
}
