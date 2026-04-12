/**
 * 書き出し PNG のフレーム装飾トークン。
 * TopBar のスペース名グラデ（TopBar.module.css: linear-gradient 135deg #a855f7 → #ec4899）と色味を揃える。
 * Canvas では 135deg を左→右の線形グラデで近似する。
 */
export const BRAND_PURPLE = '#a855f7';
export const BRAND_PINK = '#ec4899';

export const CANVAS_BG = '#fdf8ff';
/** 外枠グラデ（薄め） */
export const BORDER_GRADIENT_START = 'rgba(168, 85, 247, 0.45)';
export const BORDER_GRADIENT_END = 'rgba(236, 72, 153, 0.45)';

export const HEADER_BAND_TOP = '#f3e8ff';
export const HEADER_BAND_BOTTOM = '#fce7f3';

export const DATE_COLOR = '#8656a8';
export const CAPTION_COLOR = '#9b6bb5';

/** index.css body と同系 */
export const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif";

export const FONT_TITLE = `600 16px ${FONT_FAMILY}`;
export const FONT_DATE = `400 13px ${FONT_FAMILY}`;
export const FONT_CAPTION = `500 11px ${FONT_FAMILY}`;

export const FRAME_PAD = 14;
export const FRAME_LINE = 2;
export const OUTER_RADIUS = 14;
export const HEADER_MIN_H = 48;
export const QR_INNER_PAD = 10;
export const MAT_RADIUS = 12;
export const MAT_STROKE = 'rgba(167, 139, 250, 0.4)';
export const MAT_FILL = '#ffffff';
export const CAPTION_GAP = 8;
export const MAT_SHADOW_BLUR = 6;
export const MAT_SHADOW_COLOR = 'rgba(124, 58, 237, 0.12)';

export function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

export function strokeRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.stroke();
}

/** タイトル用: テキスト幅に合わせた紫→ピンクのグラデーション塗り */
export function createTitleGradient(
  ctx: CanvasRenderingContext2D,
  x0: number,
  x1: number,
  yMid: number,
): CanvasGradient {
  const g = ctx.createLinearGradient(x0, yMid, x1, yMid);
  g.addColorStop(0, BRAND_PURPLE);
  g.addColorStop(1, BRAND_PINK);
  return g;
}
