export type SharpContentRect = { x: number; y: number; width: number; height: number };

/** background-size: contain のシャープ矩形を px で算出（既定 16:9） */
export function computeSharpContentRect(
  containerW: number,
  containerH: number,
  aspectRatio = 16 / 9,
): SharpContentRect {
  if (containerW <= 0 || containerH <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const W = containerW;
  const H = containerH;
  const R = aspectRatio;

  if (W / H > R) {
    const sharpH = H;
    const sharpW = H * R;
    const sharpX = (W - sharpW) / 2;
    return { x: sharpX, y: 0, width: sharpW, height: sharpH };
  }

  const sharpW = W;
  const sharpH = W / R;
  const sharpY = (H - sharpH) / 2;
  return { x: 0, y: sharpY, width: sharpW, height: sharpH };
}

/** 論理座標（シャープ内 0–100%）→ コンテナ基準の表示 % */
export function mapLogicalToContainerPercent(
  lx: number,
  ly: number,
  containerW: number,
  containerH: number,
  aspectRatio = 16 / 9,
): { x: number; y: number } {
  if (containerW <= 0 || containerH <= 0) {
    return { x: lx, y: ly };
  }

  const { x: sharpX, y: sharpY, width: sharpW, height: sharpH } = computeSharpContentRect(
    containerW,
    containerH,
    aspectRatio,
  );

  return {
    x: ((sharpX + (lx / 100) * sharpW) / containerW) * 100,
    y: ((sharpY + (ly / 100) * sharpH) / containerH) * 100,
  };
}
