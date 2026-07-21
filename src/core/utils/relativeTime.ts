/**
 * 投稿日ラベル（時刻なし）。今年は「7月21日」、他年は「2026年7月21日」。
 * 不正日時は null。
 */
export function formatPostDateLabel(date: Date): string | null {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;

  const now = new Date();
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
  }

  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * 相対時間を計算（「今」「3分前」「2時間前」「6月20日」）
 */
export function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 60) return '今';
  if (diffMin < 60) return `${diffMin}分前`;
  if (diffHour < 24) return `${diffHour}時間前`;

  return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
}
