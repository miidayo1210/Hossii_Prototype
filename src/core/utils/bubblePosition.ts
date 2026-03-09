/**
 * 吹き出しの初期表示座標をインデックスから決定論的に算出する。
 * ストア（addHossii）とSpaceScreen（既存データのフォールバック）の両方から利用する。
 */
export function createBubblePosition(index: number): { x: number; y: number } {
  const seed = (index * 7919 + 1) % 1000;
  const seed2 = (index * 6271 + 3) % 1000;

  // 2つの乱数の平均で中央寄せ
  const r1 = seed / 1000;
  const r2 = seed2 / 1000;

  // 画面の 8% 〜 92% の範囲（端を避ける）
  const x = 8 + ((r1 + r2) / 2) * 84;
  // 縦は 12% 〜 78%（上下ナビを避ける）
  const y = 12 + ((r2 + (1 - r1)) / 2) * 66;

  return { x, y };
}
