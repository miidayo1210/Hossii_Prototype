import { toPng } from 'html-to-image';
import { renderQrValueToPngBlob } from './qrSvgToPng';
import {
  BORDER_GRADIENT_END,
  BORDER_GRADIENT_START,
  CANVAS_BG,
  CAPTION_COLOR,
  CAPTION_GAP,
  createTitleGradient,
  DATE_COLOR,
  fillRoundRect,
  FONT_CAPTION,
  FONT_DATE,
  FONT_TITLE,
  FRAME_LINE,
  FRAME_PAD,
  HEADER_BAND_BOTTOM,
  HEADER_BAND_TOP,
  HEADER_MIN_H,
  MAT_FILL,
  MAT_RADIUS,
  MAT_SHADOW_BLUR,
  MAT_SHADOW_COLOR,
  MAT_STROKE,
  OUTER_RADIUS,
  QR_INNER_PAD,
  strokeRoundRect,
} from './spaceExportFrameTheme';

export const SPACE_EXPORT_MAX_BUBBLES = 80;

export type SpaceCanvasExportOptions = {
  element: HTMLElement;
  signal?: AbortSignal;
  bubbleCount: number;
  shareUrl: string;
  spaceTitle: string;
  exportedAt: Date;
  qrPixelSize?: number;
};

export type SpaceExportErrorCode =
  | 'too_many_posts'
  | 'aborted'
  | 'capture_failed'
  | 'compose_failed';

export class SpaceExportError extends Error {
  readonly code: SpaceExportErrorCode;

  constructor(message: string, code: SpaceExportErrorCode) {
    super(message);
    this.name = 'SpaceExportError';
    this.code = code;
  }
}

function exportNodeFilter(node: Node): boolean {
  if (!(node instanceof HTMLElement)) return true;
  if (node.dataset.spaceExport === 'exclude') return false;
  if (node.hasAttribute('data-resize-handle')) return false;
  return true;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
}

function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  return loadImage(url).finally(() => URL.revokeObjectURL(url));
}

/**
 * スペース描画ルートを PNG にし、枠・タイトル・日付・QR を合成した Blob を返す。
 */
export async function exportSpaceCanvasWithFrame(
  options: SpaceCanvasExportOptions,
): Promise<Blob> {
  const {
    element,
    signal,
    bubbleCount,
    shareUrl,
    spaceTitle,
    exportedAt,
    qrPixelSize = 96,
  } = options;

  if (signal?.aborted) {
    throw new SpaceExportError('書き出しをキャンセルしました', 'aborted');
  }

  if (bubbleCount > SPACE_EXPORT_MAX_BUBBLES) {
    throw new SpaceExportError(
      `表示中の投稿が多すぎます（上限 ${SPACE_EXPORT_MAX_BUBBLES} 件）。期間・件数を絞ってからお試しください。`,
      'too_many_posts',
    );
  }

  let dataUrl: string;
  try {
    dataUrl = await toPng(element, {
      cacheBust: true,
      filter: exportNodeFilter,
      pixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    });
  } catch (e) {
    const msg =
      e instanceof Error && /security|taint|canvas/i.test(e.message)
        ? '背景画像などの読み込み制限で書き出せませんでした。単色・パターン背景なら成功することがあります。'
        : '画面の取り込みに失敗しました。しばらくしてから再度お試しください。';
    throw new SpaceExportError(msg, 'capture_failed');
  }

  if (signal?.aborted) {
    throw new SpaceExportError('書き出しをキャンセルしました', 'aborted');
  }

  let contentImg: HTMLImageElement;
  try {
    contentImg = await loadImage(dataUrl);
  } catch {
    throw new SpaceExportError('取り込んだ画像の読み込みに失敗しました', 'compose_failed');
  }

  let qrImg: HTMLImageElement;
  try {
    const qrBlob = await renderQrValueToPngBlob(shareUrl, qrPixelSize);
    qrImg = await blobToImage(qrBlob);
  } catch {
    throw new SpaceExportError('QR の生成に失敗しました', 'compose_failed');
  }

  if (signal?.aborted) {
    throw new SpaceExportError('書き出しをキャンセルしました', 'aborted');
  }

  const inset = FRAME_LINE + FRAME_PAD;
  const maxInnerW = 1400;
  const scale = Math.min(1, maxInnerW / contentImg.naturalWidth);
  const innerW = Math.round(contentImg.naturalWidth * scale);
  const innerH = Math.round(contentImg.naturalHeight * scale);

  const matW = qrImg.width + QR_INNER_PAD * 2;
  const matH = qrImg.height + QR_INNER_PAD * 2;
  const captionLineH = 14;
  const footerInnerH = captionLineH + CAPTION_GAP + matH + FRAME_PAD;
  const HEADER_H = HEADER_MIN_H;

  const W = innerW + inset * 2;
  const H = inset + HEADER_H + innerH + footerInnerH + inset;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new SpaceExportError('描画に失敗しました', 'compose_failed');
  }

  ctx.fillStyle = CANVAS_BG;
  fillRoundRect(ctx, 0, 0, W, H, OUTER_RADIUS);

  const borderGrad = ctx.createLinearGradient(0, 0, W, H);
  borderGrad.addColorStop(0, BORDER_GRADIENT_START);
  borderGrad.addColorStop(1, BORDER_GRADIENT_END);
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = FRAME_LINE;
  const br = Math.max(4, OUTER_RADIUS - FRAME_LINE / 2);
  strokeRoundRect(ctx, FRAME_LINE / 2, FRAME_LINE / 2, W - FRAME_LINE, H - FRAME_LINE, br);

  const headerY0 = inset;
  const headerGrad = ctx.createLinearGradient(0, headerY0, 0, headerY0 + HEADER_H);
  headerGrad.addColorStop(0, HEADER_BAND_TOP);
  headerGrad.addColorStop(1, HEADER_BAND_BOTTOM);
  ctx.fillStyle = headerGrad;
  ctx.fillRect(inset, headerY0, W - inset * 2, HEADER_H);

  const dateStr = new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(exportedAt);

  ctx.font = FONT_DATE;
  const dateW = ctx.measureText(dateStr).width;
  const headerMidY = headerY0 + HEADER_H / 2;
  const titleGap = 16;
  const titleMaxW = Math.max(80, W - inset * 2 - dateW - titleGap);

  let title =
    spaceTitle.length > 42 ? `${spaceTitle.slice(0, 41)}…` : spaceTitle;
  ctx.font = FONT_TITLE;
  while (ctx.measureText(title).width > titleMaxW && title.length > 1) {
    if (title.endsWith('…')) {
      const base = title.slice(0, -1);
      title = base.length <= 1 ? '…' : `${base.slice(0, -1)}…`;
    } else {
      title = `${title.slice(0, -1)}…`;
    }
  }

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const titleX = inset;
  const tw = ctx.measureText(title).width;
  ctx.fillStyle = createTitleGradient(ctx, titleX, titleX + tw, headerMidY);
  ctx.fillText(title, titleX, headerMidY);

  ctx.font = FONT_DATE;
  ctx.fillStyle = DATE_COLOR;
  ctx.textAlign = 'right';
  ctx.fillText(dateStr, W - inset, headerMidY);
  ctx.textAlign = 'left';

  const imgX = inset;
  const imgY = headerY0 + HEADER_H;
  ctx.drawImage(contentImg, imgX, imgY, innerW, innerH);

  const matX = W - inset - matW;
  const matY = imgY + innerH + captionLineH + CAPTION_GAP;

  ctx.save();
  ctx.shadowColor = MAT_SHADOW_COLOR;
  ctx.shadowBlur = MAT_SHADOW_BLUR;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = MAT_FILL;
  fillRoundRect(ctx, matX, matY, matW, matH, MAT_RADIUS);
  ctx.restore();

  ctx.strokeStyle = MAT_STROKE;
  ctx.lineWidth = 1;
  strokeRoundRect(ctx, matX, matY, matW, matH, MAT_RADIUS);

  ctx.drawImage(qrImg, matX + QR_INNER_PAD, matY + QR_INNER_PAD);

  ctx.fillStyle = CAPTION_COLOR;
  ctx.font = FONT_CAPTION;
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'right';
  ctx.fillText('スペースに参加', matX + matW, matY - CAPTION_GAP);
  ctx.textAlign = 'left';

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new SpaceExportError('PNG の生成に失敗しました', 'compose_failed'));
      },
      'image/png',
      0.92,
    );
  });
}

export function downloadSpaceExportBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
