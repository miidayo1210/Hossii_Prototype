/** Type B v1: 起点 Bubble の近くへ新規 Bubble の初期座標を決定論的に算出 */

export type TypeBPlacementPoint = {
  x: number;
  y: number;
};

export type TypeBPlacementBounds = {
  min: number;
  max: number;
};

export type ComputeTypeBNearOriginPlacementInput = {
  origin: TypeBPlacementPoint;
  existingPositions: readonly TypeBPlacementPoint[];
  seed?: string | number;
  minimumDistance?: number;
  bounds?: TypeBPlacementBounds;
  margin?: number;
};

export type TypeBNearOriginPlacementResult = {
  positionX: number;
  positionY: number;
};

export const TYPE_B_PLACEMENT_DEFAULT_MIN_DISTANCE = 12;
export const TYPE_B_PLACEMENT_DEFAULT_BOUNDS: TypeBPlacementBounds = { min: 0, max: 100 };
export const TYPE_B_PLACEMENT_DEFAULT_MARGIN = 0;

/** 仕様 D.2: 右 → 右下 → 下 → 左下 …（時計回り 45° 刻み） */
export const TYPE_B_PLACEMENT_ANGLE_CANDIDATES_DEG = [
  0, 45, 90, 135, 180, 225, 270, 315,
] as const;

const RADIUS_STEP = 4;
const MAX_RADIUS_STEPS = 24;

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function distance(a: TypeBPlacementPoint, b: TypeBPlacementPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function clampTypeBPlacementPoint(
  point: TypeBPlacementPoint,
  bounds: TypeBPlacementBounds,
  margin: number,
): TypeBPlacementPoint {
  const min = bounds.min + margin;
  const max = bounds.max - margin;
  return {
    x: Math.min(max, Math.max(min, point.x)),
    y: Math.min(max, Math.max(min, point.y)),
  };
}

export function typeBPlacementCollides(
  candidate: TypeBPlacementPoint,
  existingPositions: readonly TypeBPlacementPoint[],
  minimumDistance: number,
): boolean {
  return existingPositions.some(
    (existing) => distance(candidate, existing) < minimumDistance,
  );
}

function seedToAngleOffset(seed?: string | number): number {
  if (seed == null) return 0;
  if (typeof seed === 'number') {
    return Math.abs(Math.trunc(seed)) % TYPE_B_PLACEMENT_ANGLE_CANDIDATES_DEG.length;
  }
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (Math.imul(31, hash) + seed.charCodeAt(i)) >>> 0;
  }
  return hash % TYPE_B_PLACEMENT_ANGLE_CANDIDATES_DEG.length;
}

function rotateAngleCandidates(offset: number): readonly number[] {
  const angles = TYPE_B_PLACEMENT_ANGLE_CANDIDATES_DEG;
  const normalized = ((offset % angles.length) + angles.length) % angles.length;
  return [...angles.slice(normalized), ...angles.slice(0, normalized)];
}

function polarFromOrigin(
  origin: TypeBPlacementPoint,
  radius: number,
  angleDeg: number,
): TypeBPlacementPoint {
  const rad = degToRad(angleDeg);
  return {
    x: origin.x + radius * Math.cos(rad),
    y: origin.y + radius * Math.sin(rad),
  };
}

function buildAngleSearchOrder(seedOffset: number, includeRightFirst: boolean): number[] {
  const rotated = rotateAngleCandidates(seedOffset);
  if (!includeRightFirst) {
    return [...rotated];
  }
  const withoutRight = rotated.filter((angle) => angle !== 0);
  return [0, ...withoutRight];
}

/**
 * 起点の右側を第一候補とし、衝突時は角度・半径を段階的に変えて探索する。
 * 起点座標は変更しない（返却値は新規 Bubble 用のみ）。
 */
export function computeTypeBNearOriginPlacement(
  input: ComputeTypeBNearOriginPlacementInput,
): TypeBNearOriginPlacementResult {
  const minimumDistance = input.minimumDistance ?? TYPE_B_PLACEMENT_DEFAULT_MIN_DISTANCE;
  const bounds = input.bounds ?? TYPE_B_PLACEMENT_DEFAULT_BOUNDS;
  const margin = input.margin ?? TYPE_B_PLACEMENT_DEFAULT_MARGIN;
  const seedOffset = seedToAngleOffset(input.seed);

  for (let radiusStep = 0; radiusStep <= MAX_RADIUS_STEPS; radiusStep += 1) {
    const radius = minimumDistance + radiusStep * RADIUS_STEP;
    const angleOrder = buildAngleSearchOrder(seedOffset, radiusStep === 0);

    for (const angleDeg of angleOrder) {
      const raw = polarFromOrigin(input.origin, radius, angleDeg);
      const clamped = clampTypeBPlacementPoint(raw, bounds, margin);

      if (
        !typeBPlacementCollides(clamped, input.existingPositions, minimumDistance)
      ) {
        return { positionX: clamped.x, positionY: clamped.y };
      }
    }
  }

  // 探索上限到達時: bounds 内で既存から最も離れた clamped 点を返す（決定的フォールバック）
  let best = clampTypeBPlacementPoint(
    polarFromOrigin(input.origin, minimumDistance, 0),
    bounds,
    margin,
  );
  let bestClearance = Math.min(
    ...input.existingPositions.map((existing) => distance(best, existing)),
    Infinity,
  );

  for (const angleDeg of rotateAngleCandidates(seedOffset)) {
    for (let radiusStep = 0; radiusStep <= MAX_RADIUS_STEPS; radiusStep += 1) {
      const radius = minimumDistance + radiusStep * RADIUS_STEP;
      const clamped = clampTypeBPlacementPoint(
        polarFromOrigin(input.origin, radius, angleDeg),
        bounds,
        margin,
      );
      const clearance = Math.min(
        ...input.existingPositions.map((existing) => distance(clamped, existing)),
        Infinity,
      );
      if (
        clearance > bestClearance ||
        (clearance === bestClearance &&
          (clamped.x < best.x ||
            (clamped.x === best.x && clamped.y < best.y)))
      ) {
        best = clamped;
        bestClearance = clearance;
      }
    }
  }

  return { positionX: best.x, positionY: best.y };
}
