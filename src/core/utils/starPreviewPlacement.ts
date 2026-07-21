/** 星が右側（%）にあるとき吹き出しを左寄せにする閾値 */
export const STAR_PREVIEW_X_THRESHOLD = 60;

/** 星が上側（%）にあるとき吹き出しを下に出す閾値 */
export const STAR_PREVIEW_Y_THRESHOLD = 35;

/** SP横向き: やや早めに端寄せする */
export const STAR_PREVIEW_LANDSCAPE_X_THRESHOLD = 55;

/** SP横向き: 低い画面高に合わせた上下判定 */
export const STAR_PREVIEW_LANDSCAPE_Y_THRESHOLD = 38;

/** SP横向き星モードの media query（StarView と CSS で共有） */
export const MOBILE_LANDSCAPE_STAR_PREVIEW_MQ =
  '(max-width: 768px) and (max-height: 600px) and (orientation: landscape)';

export type StarPreviewHorizontal = 'left' | 'right';
export type StarPreviewVertical = 'above' | 'below';

export type StarPreviewPlacementOptions = {
  landscape?: boolean;
};

/** x が右側 → 吹き出しは left 寄せ（左方向へ広がる） */
export function resolveStarPreviewHorizontal(
  x: number,
  options: StarPreviewPlacementOptions = {},
): StarPreviewHorizontal {
  const threshold = options.landscape
    ? STAR_PREVIEW_LANDSCAPE_X_THRESHOLD
    : STAR_PREVIEW_X_THRESHOLD;
  return x > threshold ? 'left' : 'right';
}

/** y が上側 → 吹き出しは below、下側 → above */
export function resolveStarPreviewVertical(
  y: number,
  options: StarPreviewPlacementOptions = {},
): StarPreviewVertical {
  const threshold = options.landscape
    ? STAR_PREVIEW_LANDSCAPE_Y_THRESHOLD
    : STAR_PREVIEW_Y_THRESHOLD;
  return y < threshold ? 'below' : 'above';
}
