import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export default function NotificationsPermission() {
  const [supported, setSupported] = useState(false);
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    const hasNotifications = typeof Notification !== 'undefined' && typeof Notification.requestPermission === 'function';
    setSupported(hasNotifications && 'serviceWorker' in navigator && 'PushManager' in window);
    setGranted(hasNotifications && Notification.permission === 'granted');
  }, []);

  if (!supported || granted) return null;

  return (
    <Button variant="outline" size="sm" onClick={async () => {
      if (typeof Notification === 'undefined' || typeof Notification.requestPermission !== 'function') return;
      const perm = await Notification.requestPermission();
      if (perm === 'granted') setGranted(true);
    }}>
      Ativar notificações
    </Button>
  );
}
