import type { EmotionKey } from '../types';
import type { MyHossiiDisplayState } from '../types/myHossii';
import type { MyHossiiActivity } from './myHossiiActivity';

/** 最近活動ありとみなす期間（後から変更しやすいよう定数化） */
export const MY_HOSSII_RECENT_ACTIVITY_MS = 3 * 24 * 60 * 60 * 1000;

const QUIET_MS = 7 * 24 * 60 * 60 * 1000;

const POSITIVE_EMOTIONS: EmotionKey[] = ['joy', 'fun', 'laugh', 'wow', 'moved'];
const THINKING_EMOTIONS: EmotionKey[] = ['think', 'inspire', 'empathy'];

export function isRecentlyActive(lastActivityAt: Date | null, now = Date.now()): boolean {
  if (!lastActivityAt) return false;
  return now - lastActivityAt.getTime() <= MY_HOSSII_RECENT_ACTIVITY_MS;
}

export function resolveActivityScale(lastActivityAt: Date | null, now = Date.now()): number {
  if (!isRecentlyActive(lastActivityAt, now)) return 1;
  const age = now - (lastActivityAt?.getTime() ?? 0);
  const ratio = 1 - age / MY_HOSSII_RECENT_ACTIVITY_MS;
  return 1 + Math.min(0.15, Math.max(0.05, ratio * 0.15));
}

export function deriveMyHossiiDisplayState(
  activity: MyHossiiActivity,
  now = Date.now(),
): MyHossiiDisplayState {
  const latest = activity.recentPosts[0];
  if (!latest) return 'quiet';

  const age = now - latest.createdAt.getTime();
  if (age <= MY_HOSSII_RECENT_ACTIVITY_MS) {
    if (latest.emotion && POSITIVE_EMOTIONS.includes(latest.emotion)) return 'happy';
    if (latest.emotion && THINKING_EMOTIONS.includes(latest.emotion)) return 'thinking';
    return 'active';
  }

  if (age >= QUIET_MS) return 'quiet';
  return 'default';
}

const STATE_LABELS: Record<MyHossiiDisplayState, string> = {
  default: 'ここにいるよ',
  active: '最近動きがあったよ',
  happy: '新しい気づきがあったみたい',
  thinking: '考えごとをしているみたい',
  quiet: '今日は少しゆっくり',
};

export function getMyHossiiStateLabel(state: MyHossiiDisplayState): string {
  return STATE_LABELS[state];
}
