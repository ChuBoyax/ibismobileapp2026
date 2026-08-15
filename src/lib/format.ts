/**
 * Ginagawang "10 minutes ago" ang ISO timestamp mula sa server.
 * Kapag lampas isang linggo na, petsa na lang ang ipinapakita.
 */
export function relativeTime(iso: string) {
  const then = new Date(iso).getTime();

  if (Number.isNaN(then)) return '';

  const seconds = Math.floor((Date.now() - then) / 1000);

  // Maaaring bahagyang mauna ang orasan ng server sa cellphone.
  if (seconds < 60) return 'Just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;

  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** 1248 -> "1,248" */
export function formatNumber(value: number) {
  return value.toLocaleString('en-US');
}
