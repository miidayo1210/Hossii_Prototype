/**
 * 吹き出しの初期表示座標をインデックスから決定論的に算出する。
 * ストア（addHossii）とSpaceScreen（既存データのフォールバック）の両方から利用する。
 */
/** id 文字列から決定論的 seed (0–999) */
export function idSeed(id: string, salt: number): number {
  let hash = salt;
  for (let i = 0; i < id.length; i += 1) {
    hash = (Math.imul(31, hash) + id.charCodeAt(i)) >>> 0;
  }
  return hash % 1000;
}

export function createBubblePositionFromId(id: string): { x: number; y: number } {
  const seed = idSeed(id, 7919);
  const seed2 = idSeed(id, 6271);
  const r1 = seed / 1000;
  const r2 = seed2 / 1000;
  const x = 8 + r1 * 84;
  const y = 8 + r2 * 84;
  return { x, y };
}

export function createBubblePosition(index: number): { x: number; y: number } {
  const seed = (index * 7919 + 1) % 1000;
  const seed2 = (index * 6271 + 3) % 1000;

  const r1 = seed / 1000;
  const r2 = seed2 / 1000;

  // 画面の 8% 〜 92% の範囲（端を避ける、一様分布）
  const x = 8 + r1 * 84;
  const y = 8 + r2 * 84;

  return { x, y };
}

/** 投稿の新しい順（index 0 = 最新）を左上から右へ折り返しながら格子配置する。 */
export function createOrderedBubblePosition(index: number, total: number): { x: number; y: number } {
  if (total <= 0) return { x: 50, y: 50 };
  const cols = Math.max(1, Math.ceil(Math.sqrt(total)));
  const rows = Math.ceil(total / cols);
  const col = index % cols;
  const row = Math.floor(index / cols);
  // 各セルの左上を揃える（createBubblePosition と同じ 8〜92% × 12〜78% の枠内を行×列で等分割）
  const cellW = 84 / cols;
  const cellH = 66 / Math.max(rows, 1);
  const x = 8 + col * cellW;
  const y = 12 + row * cellH;
  return { x, y };
}

const SHARP_INNER_MIN = 5;
const SHARP_INNER_MAX = 95;
const SHARP_INNER_SPAN = SHARP_INNER_MAX - SHARP_INNER_MIN;

/** モバイル壁紙向け: 論理座標をシャープ矩形内側（5–95%）に生成 */
export function createBubblePositionInSharpFromId(id: string): { x: number; y: number } {
  const seed = idSeed(id, 7919);
  const seed2 = idSeed(id, 6271);
  const r1 = seed / 1000;
  const r2 = seed2 / 1000;
  const x = SHARP_INNER_MIN + r1 * SHARP_INNER_SPAN;
  const y = SHARP_INNER_MIN + r2 * SHARP_INNER_SPAN;
  return { x, y };
}

/** モバイル壁紙向け: 論理座標をシャープ矩形内側（5–95%）に生成 */
export function createBubblePositionInSharp(index: number): { x: number; y: number } {
  const seed = (index * 7919 + 1) % 1000;
  const seed2 = (index * 6271 + 3) % 1000;

  const r1 = seed / 1000;
  const r2 = seed2 / 1000;

  const x = SHARP_INNER_MIN + r1 * SHARP_INNER_SPAN;
  const y = SHARP_INNER_MIN + r2 * SHARP_INNER_SPAN;

  return { x, y };
}

/** 投稿者グループ: 左→右に並べ、行末で折り返し（上→下）。画面内に収める */
export function createAuthorRowPosition(index: number, total: number): { x: number; y: number } {
  const startX = 8;
  const startY = 16;
  const spanX = 84;
  const spanY = 62;
  const minCellW = 20;
  return createAuthorWrapGrid(index, total, { startX, startY, spanX, spanY, minCellW });
}

/** モバイル壁紙向け: 投稿者まとめの折り返し格子（シャープ矩形内） */
export function createAuthorRowPositionInSharp(
  index: number,
  total: number,
): { x: number; y: number } {
  const minCellW = 22;
  return createAuthorWrapGrid(index, total, {
    startX: SHARP_INNER_MIN,
    startY: SHARP_INNER_MIN + 4,
    spanX: SHARP_INNER_SPAN,
    spanY: SHARP_INNER_SPAN - 8,
    minCellW,
  });
}

function createAuthorWrapGrid(
  index: number,
  total: number,
  bounds: { startX: number; startY: number; spanX: number; spanY: number; minCellW: number },
): { x: number; y: number } {
  if (total <= 0) return { x: bounds.startX, y: bounds.startY };
  const cols = Math.max(1, Math.min(total, Math.floor(bounds.spanX / bounds.minCellW)));
  const rows = Math.ceil(total / cols);
  const col = index % cols;
  const row = Math.floor(index / cols);
  const cellW = bounds.spanX / cols;
  const cellH = bounds.spanY / Math.max(rows, 1);
  return {
    x: bounds.startX + col * cellW,
    y: bounds.startY + row * cellH,
  };
}

/** 投稿順格子をシャープ矩形内側（5–95%）に配置 */
export function createOrderedBubblePositionInSharp(
  index: number,
  total: number,
): { x: number; y: number } {
  if (total <= 0) return { x: 50, y: 50 };
  const cols = Math.max(1, Math.ceil(Math.sqrt(total)));
  const rows = Math.ceil(total / cols);
  const col = index % cols;
  const row = Math.floor(index / cols);
  const cellW = SHARP_INNER_SPAN / cols;
  const cellH = SHARP_INNER_SPAN / Math.max(rows, 1);
  const x = SHARP_INNER_MIN + col * cellW;
  const y = SHARP_INNER_MIN + row * cellH;
  return { x, y };
}
