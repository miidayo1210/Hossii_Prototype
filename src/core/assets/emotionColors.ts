import type { EmotionKey } from '../types';

/** StarView / AuthorClusterBubble と共通の感情カラーパレット */
export const EMOTION_COLORS: Record<EmotionKey, string> = {
  joy: '#fbbf24',
  wow: '#60a5fa',
  empathy: '#f472b6',
  inspire: '#a78bfa',
  think: '#10b981',
  laugh: '#f59e0b',
  moved: '#ec4899',
  fun: '#8b5cf6',
};

export const DEFAULT_EMOTION_COLOR = '#9ca3af';

export function getEmotionColor(emotion?: EmotionKey): string {
  if (!emotion) return DEFAULT_EMOTION_COLOR;
  return EMOTION_COLORS[emotion] ?? DEFAULT_EMOTION_COLOR;
}
