export type Point2D = { x: number; y: number };

export const DEFAULT_MAX_PULL_DISTANCE_PX = 120;

/** pointer origin から current への drag vector */
export function computeDragVector(origin: Point2D, current: Point2D): Point2D {
  return {
    x: current.x - origin.x,
    y: current.y - origin.y,
  };
}

export function computeDistance(vector: Point2D): number {
  return Math.hypot(vector.x, vector.y);
}

/** 0–1 に clamp した pull progress */
export function computeNormalizedProgress(
  distance: number,
  maxDistance = DEFAULT_MAX_PULL_DISTANCE_PX,
): number {
  if (maxDistance <= 0) return 0;
  return Math.min(1, Math.max(0, distance / maxDistance));
}

/** 接続先 Bubble の一時変位（transform 用・left/top は触らない） */
export function computeConnectedBubbleShift(
  pullVector: Point2D,
  progress: number,
  followRatio = 0.35,
): Point2D {
  const damp = Math.min(1, Math.max(0, progress));
  return {
    x: pullVector.x * followRatio * damp,
    y: pullVector.y * followRatio * damp,
  };
}

/** 2-hop 星粒の表示数（progress に応じて 1〜3） */
export function computeTwoHopStarParticleCount(progress: number): 1 | 2 | 3 {
  const p = Math.min(1, Math.max(0, progress));
  if (p >= 0.66) return 3;
  if (p >= 0.33) return 2;
  return 1;
}

export function computePullGlowProgress(progress: number): number {
  return Math.min(1, Math.max(0, progress));
}
