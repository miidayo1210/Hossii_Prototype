/** PC custom-mode bubble drag threshold (px). Matches AuthorClusterBubble. */
export const BUBBLE_DRAG_THRESHOLD_PX = 5;

export function exceedsBubbleDragThreshold(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) >= BUBBLE_DRAG_THRESHOLD_PX;
}
