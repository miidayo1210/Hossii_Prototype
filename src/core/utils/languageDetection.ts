import type { LanguageCode } from '../types';

/**
 * テキストの言語を検出する（日本語 / 英語 / 不明）
 * @param text 検出対象のテキスト
 * @returns 'ja' | 'en' | 'unknown'
 */
export function detectLanguage(text: string): LanguageCode {
  if (!text || text.trim().length === 0) {
    return 'unknown';
  }

  // 日本語文字（ひらがな、カタカナ、漢字）を含むかチェック
  const hasJapanese = /[ぁ-んァ-ン一-龥]/.test(text);
  // 英字を含むかチェック
  const hasEnglish = /[a-zA-Z]/.test(text);

  // 日本語が含まれていれば日本語として判定（混在の場合も日本語を優先）
  if (hasJapanese) {
    return 'ja';
  }

  // 日本語が含まれず、英字が含まれていれば英語
  if (hasEnglish) {
    return 'en';
  }

  // どちらも含まれない場合は不明
  return 'unknown';
}

/**
 * LanguageCodeからWeb Speech APIの言語コードに変換
 * @param language 'ja' | 'en' | 'unknown'
 * @returns Web Speech APIの言語コード ('ja-JP' | 'en-US')
 */
export function getWebSpeechLanguage(language: LanguageCode): string {
  switch (language) {
    case 'ja':
      return 'ja-JP';
    case 'en':
      return 'en-US';
    case 'unknown':
    default:
      return 'ja-JP'; // デフォルトは日本語
  }
}
