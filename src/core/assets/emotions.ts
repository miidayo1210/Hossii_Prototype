/**
 * Hossii感情システム - 最小移植版
 * 旧Leapday HossiiAssets.ts から段階移植
 */

import type { EmotionKey } from '../types';

// ============================================
// 型定義
// ============================================

/** 旧Leapdayの13種感情キー（将来用に保存） */
export type LegacyEmotionKey13 =
  | 'good'
  | 'wow'
  | 'sparkle'
  | 'deep'
  | 'fire'
  | 'yattane'
  | 'support'
  | 'fun'
  | 'happy'
  | 'love'
  | 'idea'
  | 'laughcry'
  | 'stab';

/** 現行8種（core/types から再利用） */
export type EmotionKey8 = EmotionKey;

/** 森演出メタ（最小版） */
export type ForestObjectStyleMin = {
  count?: number | [number, number];
  float?: 'slow' | 'normal' | 'none';
  priority?: number;
};

// ============================================
// 絵文字マッピング
// ============================================

export const EMOJI_BY_EMOTION: Record<EmotionKey8, string> = {
  wow: '😮',
  empathy: '😍',
  inspire: '🤯',
  think: '🤔',
  laugh: '😂',
  joy: '🥰',
  moved: '😢',
  fun: '✨',
};

// ============================================
// セリフ（bubble）
// ============================================

export const BUBBLE_BY_EMOTION: Record<EmotionKey8, string[]> = {
  wow: ['ぽよっ！？すごっ', 'わぁ…！', 'びっくりしたぁ'],
  empathy: ['わかる…！', 'それな〜', 'めっちゃ刺さる'],
  inspire: ['ぽかっ！ひらめいた', 'あ、それだ！', '光、見えた'],
  think: ['気になる…', 'ふむふむ', 'もっと知りたい'],
  laugh: ['笑っちゃう…', 'くす…うぅ…', 'だめ、笑い泣き'],
  joy: ['うれしい〜', 'しあわせ…', 'にこにこ…'],
  moved: ['こころ…動いた…', 'ぐっときた…', 'だいじにしたい'],
  fun: ['くふふ、楽しい', 'わ〜い！', 'ずっと続けたい'],
};

// ============================================
// 森演出メタ（最小版）
// ============================================

export const FOREST_OBJECT_STYLE_MIN: Partial<Record<EmotionKey8, ForestObjectStyleMin>> = {
  wow: { count: [3, 5], float: 'normal', priority: 2 },
  empathy: { count: [1, 2], float: 'slow', priority: 1 },
  inspire: { count: 1, float: 'none', priority: 5 },
  think: { count: [4, 7], float: 'slow', priority: 3 },
  laugh: { count: [2, 3], float: 'normal', priority: 2 },
  joy: { count: [3, 5], float: 'slow', priority: 3 },
  moved: { count: [1, 2], float: 'slow', priority: 5 },
  fun: { count: [5, 8], float: 'normal', priority: 4 },
};

// ============================================
// ユーティリティ関数
// ============================================

/**
 * 現行8種の感情キーからランダムにセリフを取得
 */
export function getRandomBubble8(emotion: EmotionKey8): string {
  const bubbles = BUBBLE_BY_EMOTION[emotion];
  return bubbles[Math.floor(Math.random() * bubbles.length)];
}

/**
 * 森オブジェクトの出現数を計算
 */
export function getForestObjectCount8(emotion: EmotionKey8): number {
  const style = FOREST_OBJECT_STYLE_MIN[emotion];
  if (!style?.count) return 1;

  const count = style.count;
  if (Array.isArray(count)) {
    const [min, max] = count;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  return count;
}
