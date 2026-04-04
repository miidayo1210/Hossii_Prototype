/**
 * F01: 投稿・編集で共有する吹き出し色の4テーマ（各8色 + UI上の「デフォルト」= 未指定）。
 */

export type BubblePaletteId = 'mono' | 'lavender' | 'vivid' | 'pastel';

export type BubblePaletteDef = {
  id: BubblePaletteId;
  /** ツールチップ・aria 用 */
  label: string;
  /** テーマボタン用の細いグラデーション（3ストップ程度） */
  previewStops: [string, string, string];
  /** スウォッチ8色 */
  colors: string[];
};

const VIVID_COLORS: string[] = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEAA7',
  '#DDA0DD',
  '#98D8C8',
  '#F7DC6F',
];

/** スペース上のインライン編集と揃えるパステル（Tree.tsx 従来値） */
const PASTEL_COLORS: string[] = [
  '#FFB3B3',
  '#FFD9B3',
  '#FFFAB3',
  '#B3FFB8',
  '#B3E0FF',
  '#D9B3FF',
  '#FFB3E6',
  '#FFFFFF',
];

const MONO_COLORS: string[] = [
  '#FAFAF9',
  '#F5F5F4',
  '#E7E5E4',
  '#D6D3D1',
  '#A8A29E',
  '#78716C',
  '#57534E',
  '#44403C',
];

const LAVENDER_COLORS: string[] = [
  '#FFFFFF',
  '#FAF5FF',
  '#F3E8FF',
  '#E9D5FF',
  '#C4B5FD',
  '#A78BFA',
  '#F0ABFC',
  '#FBCFE8',
];

export const BUBBLE_COLOR_PALETTES: BubblePaletteDef[] = [
  {
    id: 'mono',
    label: 'モノトーン',
    previewStops: ['#F5F5F4', '#A8A29E', '#44403C'],
    colors: MONO_COLORS,
  },
  {
    id: 'lavender',
    label: 'ラベンダー',
    previewStops: ['#E9D5FF', '#A78BFA', '#FBCFE8'],
    colors: LAVENDER_COLORS,
  },
  {
    id: 'vivid',
    label: 'ビビッド',
    previewStops: ['#FF6B6B', '#45B7D1', '#F7DC6F'],
    colors: VIVID_COLORS,
  },
  {
    id: 'pastel',
    label: 'パステル',
    previewStops: ['#FFB3B3', '#B3E0FF', '#D9B3FF'],
    colors: PASTEL_COLORS,
  },
];

/** 投稿画面の初期テーマ。並びは 1:モノトーン 2:ラベンダー 3:ビビッド 4:パステル — デフォルトは 3 番目のカラフル（従来の 8 色セット）。 */
export const DEFAULT_BUBBLE_PALETTE_ID: BubblePaletteId = 'vivid';

export function getBubblePalette(id: BubblePaletteId): BubblePaletteDef {
  const found = BUBBLE_COLOR_PALETTES.find((p) => p.id === id);
  return found ?? BUBBLE_COLOR_PALETTES.find((p) => p.id === DEFAULT_BUBBLE_PALETTE_ID)!;
}

/** スペース画面バブル選択時のパレット（パステルテーマと同一8色） */
export const BUBBLE_INLINE_EDIT_COLORS = PASTEL_COLORS;
