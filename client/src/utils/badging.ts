export async function setAppBadge(total: number) {
  try {
    if ('setAppBadge' in navigator && typeof (navigator as any).setAppBadge === 'function') {
      await (navigator as any).setAppBadge(Math.max(0, Math.floor(total)));
      return true;
    }
  } catch {}
  return false;
}

export async function clearAppBadge() {
  try {
    if ('clearAppBadge' in navigator && typeof (navigator as any).clearAppBadge === 'function') {
      await (navigator as any).clearAppBadge();
      return true;
    }
  } catch {}
  return false;
}