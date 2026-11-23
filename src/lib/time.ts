export interface CountdownInfo {
  label: string;
  isOverdue: boolean;
  isUrgent: boolean;
  msRemaining: number;
}

export function getCountdown(isoDue: string, nowMs: number): CountdownInfo {
  const targetMs = new Date(isoDue).getTime();
  const diff = targetMs - nowMs;

  if (diff <= 0) {
    const overdueHours = Math.floor(Math.abs(diff) / (1000 * 60 * 60));
    const overdueDays = Math.floor(overdueHours / 24);
    const label =
      overdueDays > 0
        ? `Closed ${overdueDays}d ${overdueHours % 24}h ago`
        : overdueHours > 0
          ? `Closed ${overdueHours}h ago`
          : 'Closed moments ago';
    return { label, isOverdue: true, isUrgent: false, msRemaining: diff };
  }

  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  let label = '';
  if (days > 0) {
    label = `${days}d ${hours}h ${minutes}m left`;
  } else if (hours > 0) {
    label = `${hours}h ${minutes}m left`;
  } else {
    const seconds = Math.floor((diff % 60000) / 1000);
    label = `${minutes}m ${seconds}s left`;
  }

  return {
    label,
    isOverdue: false,
    isUrgent: diff <= 1000 * 60 * 60 * 48,
    msRemaining: diff,
  };
}

export function formatAcademicDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function toLocalDateTimeInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
