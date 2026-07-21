/** 星が右側（%）にあるとき吹き出しを左寄せにする閾値 */
export const STAR_PREVIEW_X_THRESHOLD = 60;

/** 星が上側（%）にあるとき吹き出しを下に出す閾値 */
export const STAR_PREVIEW_Y_THRESHOLD = 35;

export type StarPreviewHorizontal = 'left' | 'right';
export type StarPreviewVertical = 'above' | 'below';

/** x が右側 → 吹き出しは left 寄せ（左方向へ広がる） */
export function resolveStarPreviewHorizontal(x: number): StarPreviewHorizontal {
  return x > STAR_PREVIEW_X_THRESHOLD ? 'left' : 'right';
}

/** y が上側 → 吹き出しは below、下側 → above */
export function resolveStarPreviewVertical(y: number): StarPreviewVertical {
  return y < STAR_PREVIEW_Y_THRESHOLD ? 'below' : 'above';
}
