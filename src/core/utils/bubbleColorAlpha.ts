/** 吹き出し背景の既定アルファ（仕様 77） */
export const BUBBLE_BG_ALPHA = 0.8;
export const BUBBLE_BG_ALPHA_HOVER = 0.9;

const ALPHA_MIN = 0.72;
const ALPHA_MAX = 0.95;

function clampAlpha(alpha: number): number {
  return Math.min(ALPHA_MAX, Math.max(ALPHA_MIN, alpha));
}

function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim();
  const short = /^#([0-9a-fA-F]{3})$/;
  const long = /^#([0-9a-fA-F]{6})$/;

  const shortMatch = normalized.match(short);
  if (shortMatch) {
    const h = shortMatch[1];
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
    };
  }

  const longMatch = normalized.match(long);
  if (longMatch) {
    const h = longMatch[1];
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }

  return null;
}

function parseRgbaColor(color: string): { r: number; g: number; b: number; a: number } | null {
  const match = color.trim().match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/);
  if (!match) return null;

  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    a: match[4] !== undefined ? Number(match[4]) : 1,
  };
}

/** hex / rgba を吹き出し用の半透明 rgba に変換 */
export function withBubbleAlpha(color: string, alpha: number = BUBBLE_BG_ALPHA): string {
  const clamped = clampAlpha(alpha);

  const rgba = parseRgbaColor(color);
  if (rgba) {
    return `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${clamped})`;
  }

  const hex = parseHexColor(color);
  if (hex) {
    return `rgba(${hex.r}, ${hex.g}, ${hex.b}, ${clamped})`;
  }

  return color;
}
