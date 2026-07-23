export type Point2D = { x: number; y: number };

export const DEFAULT_MAX_PULL_DISTANCE_PX = 120;
export const DEFAULT_CONNECTED_FOLLOW_RATIO = 0.35;
/** 接続先 Bubble の一時変位上限（120px × 0.35 = 42px 理論値を抑え、Bubble 半径内に収める） */
export const MAX_CONNECTED_SHIFT_PX = 36;
/** reduced-motion 時の glow 上限（操作状態の静的インジケータ） */
export const REDUCED_MOTION_GLOW_CAP = 0.25;

/** pointer origin から current への drag vector（未 clamp） */
export function computeDragVector(origin: Point2D, current: Point2D): Point2D {
  return {
    x: current.x - origin.x,
    y: current.y - origin.y,
  };
}

export function computeDistance(vector: Point2D): number {
  return Math.hypot(vector.x, vector.y);
}

/** ベクトル長を maxMagnitude 以内に clamp（方向維持） */
export function clampVectorMagnitude(vector: Point2D, maxMagnitude: number): Point2D {
  if (maxMagnitude <= 0) return { x: 0, y: 0 };
  const distance = computeDistance(vector);
  if (distance <= maxMagnitude || distance === 0) return vector;
  const scale = maxMagnitude / distance;
  return { x: vector.x * scale, y: vector.y * scale };
}

/** CSS へ渡す pull vector（maxDistance 以内・方向維持） */
export function clampPullVector(
  vector: Point2D,
  maxDistance = DEFAULT_MAX_PULL_DISTANCE_PX,
): Point2D {
  return clampVectorMagnitude(vector, maxDistance);
}

/** 0–1 に clamp した pull progress */
export function computeNormalizedProgress(
  distance: number,
  maxDistance = DEFAULT_MAX_PULL_DISTANCE_PX,
): number {
  if (maxDistance <= 0) return 0;
  return Math.min(1, Math.max(0, distance / maxDistance));
}

export type ConnectedBubbleShiftOptions = {
  followRatio?: number;
  maxShift?: number;
  reducedMotion?: boolean;
};

/** 接続先 Bubble の一時変位（transform 用・left/top は触らない） */
export function computeConnectedBubbleShift(
  pullVector: Point2D,
  progress: number,
  options: ConnectedBubbleShiftOptions = {},
): Point2D {
  const {
    followRatio = DEFAULT_CONNECTED_FOLLOW_RATIO,
    maxShift = MAX_CONNECTED_SHIFT_PX,
    reducedMotion = false,
  } = options;

  if (reducedMotion) return { x: 0, y: 0 };

  const damp = Math.min(1, Math.max(0, progress));
  const raw: Point2D = {
    x: pullVector.x * followRatio * damp,
    y: pullVector.y * followRatio * damp,
  };
  return clampVectorMagnitude(raw, maxShift);
}

/** visible 2-hop 件数を pull 中 peer 星粒数（1〜3）へ clamp。0 は非表示 */
export function clampTwoHopStarDisplayCount(count: number): 0 | 1 | 2 | 3 {
  if (count <= 0) return 0;
  if (count >= 3) return 3;
  return count as 1 | 2 | 3;
}

/** 2-hop 星粒の表示数（progress に応じて 1〜3） */
export function computeTwoHopStarParticleCount(
  progress: number,
  reducedMotion = false,
): 1 | 2 | 3 {
  if (reducedMotion) return 1;
  const p = Math.min(1, Math.max(0, progress));
  if (p >= 0.66) return 3;
  if (p >= 0.33) return 2;
  return 1;
}

export function computePullGlowProgress(progress: number, reducedMotion = false): number {
  const p = Math.min(1, Math.max(0, progress));
  if (reducedMotion) return Math.min(p, REDUCED_MOTION_GLOW_CAP);
  return p;
}
