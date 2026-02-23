import type { EmotionKey, Hossii } from '../types';

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

export const renderHossiiText = (h: Hossii): string => {
  const emoji = h.emotion ? EMOJI_BY_EMOTION[h.emotion] : '';
  const msg = (h.message ?? '').trim();

  if (emoji && msg) return `${emoji} ${msg}`;
  if (emoji) return emoji;
  return msg;
};
