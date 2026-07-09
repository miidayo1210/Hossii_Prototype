import type { Hossii } from '../types';
import { renderHossiiText } from './render';

export const MAX_BUBBLE_TEXT_LENGTH = 120;
export const MAX_STAR_PREVIEW_TEXT_LENGTH = 60;

/** 吹き出し・プレビュー用の正本テキスト（笑いログは空） */
export function getHossiiBubbleFullText(hossii: Hossii): string {
  if (hossii.autoType === 'laughter') return '';
  if (hossii.logType === 'speech' || hossii.autoType === 'speech') {
    return renderHossiiText(hossii).trim();
  }
  return (hossii.message ?? '').trim();
}

export function truncateBubbleDisplayText(
  text: string,
  max = MAX_BUBBLE_TEXT_LENGTH,
): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '…';
}

export function truncateStarPreviewText(
  text: string,
  max = MAX_STAR_PREVIEW_TEXT_LENGTH,
): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '…';
}

export function isCharCountTruncated(fullText: string, displayedText: string): boolean {
  const full = fullText.trim();
  if (!full) return false;
  const shown = displayedText.replace(/…$/, '').trim();
  return full.length > shown.length;
}

export function isElementLineClamped(el: HTMLElement | null): boolean {
  if (!el) return false;
  return el.scrollHeight > el.clientHeight + 1;
}

export function isHossiiTextTruncated(
  fullText: string,
  displayedText: string,
  textEl: HTMLElement | null,
): boolean {
  if (!fullText.trim()) return false;
  if (isCharCountTruncated(fullText, displayedText)) return true;
  return isElementLineClamped(textEl);
}

const BASE_BUBBLE_LINE_CLAMP = 3;
const BASE_BUBBLE_VIEW_LINE_CLAMP = 2;

/** カスタムモード: 投稿スケールに応じた表示行数（文字サイズは固定） */
export function bubbleLineClampForScale(
  viewMode: 'full' | 'bubble' | 'image' | 'slideshow',
  scale: number,
): number {
  const base = viewMode === 'bubble' ? BASE_BUBBLE_VIEW_LINE_CLAMP : BASE_BUBBLE_LINE_CLAMP;
  return Math.max(2, Math.round(base * scale));
}
