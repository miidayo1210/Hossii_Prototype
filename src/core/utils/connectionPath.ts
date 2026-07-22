import type { HossiiConnectionStrength } from '../types/hossiiConnection';
import type { Point2D } from './connectionEdgePoint';

export type ConnectionStrokeStyle = {
  strokeWidth: number;
  opacity: number;
  hitStrokeWidth: number;
  curvature: number;
};

export const CONNECTION_STRENGTH_STYLES: Record<HossiiConnectionStrength, ConnectionStrokeStyle> = {
  soft: { strokeWidth: 1.5, opacity: 0.42, hitStrokeWidth: 16, curvature: 0.14 },
  medium: { strokeWidth: 2.5, opacity: 0.62, hitStrokeWidth: 16, curvature: 0.1 },
  strong: { strokeWidth: 3.5, opacity: 0.82, hitStrokeWidth: 16, curvature: 0.07 },
};

/** 2点間の糸 path（二次ベジェ・強さで曲率を変える） */
export function buildConnectionPath(
  from: Point2D,
  to: Point2D,
  strength: HossiiConnectionStrength,
): string {
  const style = CONNECTION_STRENGTH_STYLES[strength];
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = -dy / dist;
  const ny = dx / dist;
  const offset = dist * style.curvature;
  const ctrlX = midX + nx * offset;
  const ctrlY = midY + ny * offset;
  return `M ${from.x} ${from.y} Q ${ctrlX} ${ctrlY} ${to.x} ${to.y}`;
}

export function getConnectionStrokeStyle(strength: HossiiConnectionStrength): ConnectionStrokeStyle {
  return CONNECTION_STRENGTH_STYLES[strength];
}
