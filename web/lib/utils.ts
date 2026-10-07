export function timeAgo(value: string | null | undefined, now = Date.now()): string {
  if (!value) return 'Never received';
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return 'Unknown time';
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}
