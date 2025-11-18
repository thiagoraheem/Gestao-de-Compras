import { useEffect, useRef } from 'react';
import { setAppBadge, clearAppBadge } from '@/utils/badging';

async function fetchPending() {
  const r = await fetch('/api/approvals/pending-count', { credentials: 'include' });
  if (!r.ok) throw new Error('Erro ao buscar pendências');
  return r.json() as Promise<{ a1: number; a2: number; total: number; ts: string }>;
}

async function ensureVapidKey() {
  if ((window as any).VAPID_PUBLIC_KEY_BASE64URL) return (window as any).VAPID_PUBLIC_KEY_BASE64URL;
  const r = await fetch('/api/notifications/vapid-public-key', { credentials: 'include' });
  if (!r.ok) return null;
  const j = await r.json();
  (window as any).VAPID_PUBLIC_KEY_BASE64URL = j.publicKey;
  return j.publicKey;
}

async function ensurePushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) return sub;
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return null;
  const vapid = await ensureVapidKey();
  if (!vapid) return null;
  const converted = Uint8Array.from(atob(vapid.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: converted });
}

export function useApprovalsBadge() {
  const lastTotalRef = useRef<number>(Number(localStorage.getItem('lastApprovalsTotal') || 0));

  useEffect(() => {
    let timer: any;

    const update = async () => {
      try {
        const { total } = await fetchPending();

        if (total > 0) await setAppBadge(total); else await clearAppBadge();

        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.ready;
          if (Notification.permission === 'granted') {
            if (total > 0) {
              await (reg as any).showNotification(`Você tem ${total} aprovações pendentes`, {
                body: `Soma de A1 + A2: ${total}. Toque para revisar.`,
                tag: 'approvals-badge',
                renotify: true,
                icon: '/icons/icon-192.png',
                badge: '/icons/badge-72.png',
                data: { total }
              });
            } else {
              const list = await (reg as any).getNotifications({ tag: 'approvals-badge' });
              list.forEach(n => n.close());
            }
          }
        }

        const prev = lastTotalRef.current;
        if (Notification.permission === 'granted' && total > prev) {
          const reg = await navigator.serviceWorker.ready;
          await (reg as any).showNotification(`Novas aprovações: ${total - prev}`, {
            body: `Total pendente agora: ${total}.`,
            tag: 'approvals-new',
            renotify: false,
            icon: '/icons/icon-192.png',
            badge: '/icons/badge-72.png',
            data: { total }
          });
        }

        lastTotalRef.current = total;
        localStorage.setItem('lastApprovalsTotal', String(total));
      } catch {}
    };

    const start = async () => {
      const sub = await ensurePushSubscription();
      if (sub) {
        await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(sub)
        });
      }

      await update();

      const onVis = () => document.visibilityState === 'visible' && update();
      const onFocus = () => update();
      window.addEventListener('visibilitychange', onVis);
      window.addEventListener('focus', onFocus);

      timer = setInterval(() => { if (document.visibilityState === 'visible') update(); }, 60000);

      return () => {
        window.removeEventListener('visibilitychange', onVis);
        window.removeEventListener('focus', onFocus);
        if (timer) clearInterval(timer);
      };
    };

    start();
  }, []);
}