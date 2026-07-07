import type { Hossii } from '../types';
import { stripEmojisForSpeech } from './stripEmojisForSpeech';

const MIN_LEN = 20;
const MAX_LEN = 40;

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export function buildMyHossiiSpeechBubbleText(hossii: Hossii): string {
  const plain = stripEmojisForSpeech(hossii.message ?? '').trim();
  if (plain.length >= 4) {
    return truncate(plain, MAX_LEN);
  }

  if (hossii.emotion === 'joy' || hossii.emotion === 'fun') {
    return '新しい気づきがあったみたい';
  }
  if (hossii.emotion === 'think' || hossii.emotion === 'inspire') {
    return '次の一歩を考え中';
  }

  return '新しいログを残しました';
}

export function isValidSpeechBubbleLength(text: string): boolean {
  return text.length >= MIN_LEN / 2 && text.length <= MAX_LEN + 4;
}

export const MY_HOSSII_SPEECH_BUBBLE_DURATION_MS = 6000;
export const MY_HOSSII_MAX_CONCURRENT_BUBBLES = 3;
