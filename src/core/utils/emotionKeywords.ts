import type { EmotionKey } from '../types';

/**
 * 感情ごとのキーワードマッピング（日本語 / 英語）
 * 注: 現在の感情検出は音声ベース（音量/変動）のみ。
 * キーワード検出は将来的な拡張のためのオプション機能。
 */
export const EMOTION_KEYWORDS: Record<EmotionKey, { ja: string[]; en: string[] }> = {
  laugh: {
    ja: ['笑', 'はは', 'ふふ', 'へへ', 'わら', '爆笑'],
    en: ['haha', 'lol', 'funny', 'laugh', 'hilarious', 'hehe'],
  },
  joy: {
    ja: ['嬉しい', 'やった', '最高', 'うれしい', '楽しい', '幸せ'],
    en: ['happy', 'excited', 'yay', 'joy', 'great', 'awesome'],
  },
  wow: {
    ja: ['すごい', 'おお', 'わお', 'へえ', '驚き', 'びっくり'],
    en: ['wow', 'amazing', 'incredible', 'whoa', 'surprised'],
  },
  empathy: {
    ja: ['わかる', 'そうだよね', '共感', 'その通り', 'うんうん'],
    en: ['understand', 'relate', 'same', 'exactly', 'i feel you'],
  },
  inspire: {
    ja: ['感動', '素晴らしい', 'すばらしい', 'インスパイア', '刺激'],
    en: ['inspiring', 'motivated', 'inspired', 'motivating', 'uplifting'],
  },
  think: {
    ja: ['なるほど', '考え', 'そうか', '思う', '興味深い'],
    en: ['think', 'interesting', 'hmm', 'thought', 'consider'],
  },
  moved: {
    ja: ['感動', '泣ける', '涙', 'じーん', '心に響く'],
    en: ['moved', 'touching', 'emotional', 'tears', 'heartfelt'],
  },
  fun: {
    ja: ['楽しい', '面白い', 'おもしろい', '楽しみ', 'ワクワク'],
    en: ['fun', 'enjoy', 'entertaining', 'enjoyable', 'exciting'],
  },
};
