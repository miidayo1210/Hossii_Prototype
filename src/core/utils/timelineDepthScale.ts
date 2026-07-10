/** filteredHossiis 内の新しい順インデックス（0 = 最新）から depth scale（108 §4） */
export function timelineDepthScaleFromIndex(index: number): number {
  if (index <= 9) return 1.0;
  if (index <= 29) return 0.94;
  if (index <= 59) return 0.88;
  return 0.82;
}

/** starDot 用 depth scale（無効時は常に 1） */
export function resolveStarDotDepthScale(timelineDepthActive: boolean, index: number): number {
  return timelineDepthActive ? timelineDepthScaleFromIndex(index) : 1;
}
