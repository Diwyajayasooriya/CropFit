// Only same-origin application paths may be used after authentication.
export function safeReturnPath(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020]/.test(value)) return null;
  try {
    const url = new URL(value, 'https://cropfit.local');
    if (url.origin !== 'https://cropfit.local' || ['/login', '/admin/login'].includes(url.pathname)) return null;
    return url.pathname + url.search + url.hash;
  } catch { return null; }
}

export function loginDestination(search: string, saved: string | null, onboardingCompleted?: boolean): string {
  const params = new URLSearchParams(search);
  const device = params.get('device_id') || params.get('device');
  if (device || params.has('code')) {
    const claim = new URLSearchParams();
    if (device) claim.set('device_id', device);
    for (const key of ['code', 'greenhouse']) if (params.has(key)) claim.set(key, params.get(key)!);
    return `/claim?${claim}`;
  }
  return safeReturnPath(params.get('redirect')) || safeReturnPath(saved) || (onboardingCompleted === false ? '/onboarding' : '/');
}
