import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';

export default function ApprovalsInlineBadge() {
  const [total, setTotal] = useState<number>(Number(localStorage.getItem('lastApprovalsTotal') || 0));
  useEffect(() => {
    const refresh = () => setTotal(Number(localStorage.getItem('lastApprovalsTotal') || 0));
    const onVis = () => document.visibilityState === 'visible' && refresh();
    const onEvt = (e: any) => { if (typeof e?.detail === 'number') setTotal(e.detail); else refresh(); };
    window.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', refresh);
    window.addEventListener('approvals-badge:update', onEvt as any);
    const t = setInterval(refresh, 120000);
    return () => { window.removeEventListener('visibilitychange', onVis); window.removeEventListener('focus', refresh); window.removeEventListener('approvals-badge:update', onEvt as any); clearInterval(t); };
  }, []);
  if (!total || total <= 0) return null;
  return <Badge variant="destructive" className="ml-2">{total}</Badge>;
}