import type { EmotionKey } from '../../../../../../../src/core/types';

/** 投稿前ピッカーで表示する8種の順序 */
export const EMOTION_PICKER_KEYS: EmotionKey[] = [
  'joy',
  'wow',
  'think',
  'empathy',
  'inspire',
  'laugh',
  'moved',
  'fun',
];

/** 日本語ラベル（PostScreen / ReflectionScreen と揃える） */
export const EMOTION_PICKER_LABELS: Record<EmotionKey, string> = {
  wow: 'Wow',
  empathy: '刺さった',
  inspire: '閃いた',
  think: '気になる',
  laugh: '笑った',
  joy: 'うれしい',
  moved: 'ぐっときた',
  fun: '楽しい',
};
