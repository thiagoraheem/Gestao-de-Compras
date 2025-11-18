import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export default function NotificationsPermission() {
  const [supported, setSupported] = useState(false);
  const [granted, setGranted] = useState(Notification.permission === 'granted');

  useEffect(() => {
    setSupported('serviceWorker' in navigator && 'PushManager' in window);
  }, []);

  if (!supported || granted) return null;

  return (
    <Button variant="outline" size="sm" onClick={async () => {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') setGranted(true);
    }}>
      Ativar notificações
    </Button>
  );
}