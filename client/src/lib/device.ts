export function isIPhone() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const iphoneOrIpod = /iPhone|iPod/i.test(ua);
  const ipadUA = /iPad/i.test(ua);
  const ipadMacTouch = navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1;
  return iphoneOrIpod || ipadUA || ipadMacTouch;
}
