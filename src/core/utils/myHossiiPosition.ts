import { createBubblePositionFromId } from './bubblePosition';
import type { MyHossiiMotionMode } from '../types/myHossii';

/** スペースHossiiが泳ぐ中心付近（%）— マイHossiiは避ける */
const CENTER_X_MIN = 35;
const CENTER_X_MAX = 65;
const CENTER_Y_MIN = 30;
const CENTER_Y_MAX = 55;

/** 安全領域: 左右操作バー・下部ナビ・投稿フォームを避ける */
const SAFE_X_MIN = 10;
const SAFE_X_MAX = 88;
const SAFE_Y_MIN = 14;
const SAFE_Y_MAX = 78;

function isInCenterZone(x: number, y: number): boolean {
  return x >= CENTER_X_MIN && x <= CENTER_X_MAX && y >= CENTER_Y_MIN && y <= CENTER_Y_MAX;
}

/**
 * userId + spaceId から決定論的な表示位置（%）を算出する。
 * 再読込時に同じユーザーは同じ位置付近に表示される。
 */
export function computeMyHossiiPosition(
  userId: string,
  spaceId: string,
  slotIndex: number,
): { x: number; y: number } {
  const seed = `${userId}:${spaceId}`;
  const base = createBubblePositionFromId(seed);

  const slotOffsetX = ((slotIndex % 5) - 2) * 6;
  const slotOffsetY = (Math.floor(slotIndex / 5) % 3) * 5;

  let x = Math.min(SAFE_X_MAX, Math.max(SAFE_X_MIN, base.x + slotOffsetX));
  let y = Math.min(SAFE_Y_MAX, Math.max(SAFE_Y_MIN, base.y + slotOffsetY));

  if (isInCenterZone(x, y)) {
    if (x < 50) {
      x = CENTER_X_MIN - 4;
    } else {
      x = CENTER_X_MAX + 4;
    }
    if (y < 42) {
      y = CENTER_Y_MIN - 3;
    } else {
      y = CENTER_Y_MAX + 3;
    }
  }

  return {
    x: Math.min(SAFE_X_MAX, Math.max(SAFE_X_MIN, x)),
    y: Math.min(SAFE_Y_MAX, Math.max(SAFE_Y_MIN, y)),
  };
}

export type ResolvedMotionMode = 'free' | 'anchored' | 'static';

/**
 * 管理者設定と投稿量・人数から実際の動き方を決定する。
 */
export function resolveMyHossiiMotionMode(
  configured: MyHossiiMotionMode,
  options: {
    participantCount: number;
    visiblePostCount: number;
    prefersReducedMotion: boolean;
  },
): ResolvedMotionMode {
  if (options.prefersReducedMotion) return 'static';

  if (configured === 'anchored') return 'anchored';
  if (configured === 'free') return 'free';

  const crowded = options.participantCount >= 10 || options.visiblePostCount >= 25;
  const moderate = options.participantCount >= 6 || options.visiblePostCount >= 12;

  if (crowded) return 'static';
  if (moderate) return 'anchored';
  return 'free';
}
