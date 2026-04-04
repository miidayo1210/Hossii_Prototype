import type { SpeechLevel } from '../types';

const LISTEN_MODE_KEY = 'hossii.listenMode';
const LISTEN_CONSENT_KEY = 'hossii.listenConsent';
const EMOTION_LOG_KEY = 'hossii.emotionLogEnabled';
const SPEECH_LEVELS_KEY = 'hossii.speechLevels';

export type SpeechLevelSettings = Record<SpeechLevel, boolean>;

const DEFAULT_SPEECH_LEVELS: SpeechLevelSettings = {
  word: false,
  short: true,
  long: true,
};

/**
 * listenMode を読み込む（デフォルト: false）
 */
export function loadListenMode(): boolean {
  try {
    const raw = localStorage.getItem(LISTEN_MODE_KEY);
    return raw === 'true';
  } catch {
    return false;
  }
}

/**
 * listenMode を保存
 */
export function saveListenMode(enabled: boolean): void {
  try {
    localStorage.setItem(LISTEN_MODE_KEY, String(enabled));
  } catch {
    // ignore
  }
}

/**
 * マイク同意状態を読み込む（デフォルト: false）
 */
export function loadListenConsent(): boolean {
  try {
    const raw = localStorage.getItem(LISTEN_CONSENT_KEY);
    return raw === 'true';
  } catch {
    return false;
  }
}

/**
 * マイク同意状態を保存
 */
export function saveListenConsent(consented: boolean): void {
  try {
    localStorage.setItem(LISTEN_CONSENT_KEY, String(consented));
  } catch {
    // ignore
  }
}

/**
 * 感情ログ（マイク音量からの笑い声・環境音の自動感情投稿）
 *
 * 現状は機能を停止しているため、常に `false` を返し、保存時も `false` を書き込む
 * （既存の `true` を残し続けない）。
 */
export function loadEmotionLogEnabled(): boolean {
  return false;
}

/** @deprecated 感情ログ自動投稿は停止中。保存しても常に false 相当。 */
export function saveEmotionLogEnabled(enabled: boolean): void {
  void enabled;
  try {
    localStorage.setItem(EMOTION_LOG_KEY, 'false');
  } catch {
    // ignore
  }
}

/**
 * 音声ログ粒度設定を読み込む
 */
export function loadSpeechLevels(): SpeechLevelSettings {
  try {
    const raw = localStorage.getItem(SPEECH_LEVELS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        word: Boolean(parsed.word),
        short: Boolean(parsed.short ?? true),
        long: Boolean(parsed.long ?? true),
      };
    }
    return DEFAULT_SPEECH_LEVELS;
  } catch {
    return DEFAULT_SPEECH_LEVELS;
  }
}

/**
 * 音声ログ粒度設定を保存
 */
export function saveSpeechLevels(levels: SpeechLevelSettings): void {
  try {
    localStorage.setItem(SPEECH_LEVELS_KEY, JSON.stringify(levels));
  } catch {
    // ignore
  }
}
