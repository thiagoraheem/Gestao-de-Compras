import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';

export default function ApprovalsInlineBadge() {
  const [total, setTotal] = useState<number>(Number(localStorage.getItem('lastApprovalsTotal') || 0));
  useEffect(() => {
    const refresh = () => setTotal(Number(localStorage.getItem('lastApprovalsTotal') || 0));
    const onVis = () => document.visibilityState === 'visible' && refresh();
    window.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', refresh);
    const t = setInterval(refresh, 30000);
    return () => { window.removeEventListener('visibilitychange', onVis); window.removeEventListener('focus', refresh); clearInterval(t); };
  }, []);
  if (!total || total <= 0) return null;
  return <Badge variant="destructive" className="ml-2">{total}</Badge>;
}