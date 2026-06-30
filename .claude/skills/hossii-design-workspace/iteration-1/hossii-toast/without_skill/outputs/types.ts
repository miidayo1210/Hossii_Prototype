/** Minimal Hossii shape for toast preview */
export type EmotionKey =
  | 'wow'
  | 'empathy'
  | 'inspire'
  | 'think'
  | 'laugh'
  | 'joy'
  | 'moved'
  | 'fun';

export type NewHossiiPayload = {
  id: string;
  message?: string;
  authorName?: string;
  emotion?: EmotionKey;
};

export const EMOJI_BY_EMOTION: Record<EmotionKey, string> = {
  wow: '😮',
  empathy: '😍',
  inspire: '🤯',
  think: '🤔',
  laugh: '😂',
  joy: '🥰',
  moved: '😢',
  fun: '✨',
};

export function formatHossiiPreview(hossii: NewHossiiPayload): string {
  const emoji = hossii.emotion ? EMOJI_BY_EMOTION[hossii.emotion] : '';
  const msg = (hossii.message ?? '').trim();
  if (emoji && msg) return `${emoji} ${msg}`;
  if (emoji) return emoji;
  if (msg) return msg;
  return '気持ちが届きました';
}
