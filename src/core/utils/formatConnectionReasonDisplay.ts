import type { HossiiConnectionReasonEmoji } from '../types/hossiiConnection';

export function hasConnectionReasonDisplay(
  reasonText: string | null | undefined,
  reasonEmoji: HossiiConnectionReasonEmoji | null | undefined,
): boolean {
  return Boolean(reasonEmoji || reasonText?.trim());
}

/** 一覧・read-only UI 向け。reason なしは null。 */
export function formatConnectionReasonDisplay(
  reasonText: string | null | undefined,
  reasonEmoji: HossiiConnectionReasonEmoji | null | undefined,
): string | null {
  const text = reasonText?.trim() ?? '';
  if (!reasonEmoji && !text) return null;
  if (reasonEmoji && text) return `${reasonEmoji} ${text}`;
  return reasonEmoji ?? text;
}
