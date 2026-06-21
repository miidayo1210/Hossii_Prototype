const VOICE_ENABLED_KEY = 'hossii.voiceEnabled';
const VOICE_CONSENT_KEY = 'hossii.voiceConsent';

/**
 * 読み上げ ON/OFF を読み込む（デフォルト: false）
 */
export function loadVoiceEnabled(): boolean {
  try {
    const raw = localStorage.getItem(VOICE_ENABLED_KEY);
    return raw === 'true';
  } catch {
    return false;
  }
}

/**
 * 読み上げ ON/OFF を保存
 */
export function saveVoiceEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(VOICE_ENABLED_KEY, String(enabled));
  } catch {
    // ignore
  }
}

/**
 * 読み上げ同意状態を読み込む（デフォルト: false）
 */
export function loadVoiceConsent(): boolean {
  try {
    const raw = localStorage.getItem(VOICE_CONSENT_KEY);
    return raw === 'true';
  } catch {
    return false;
  }
}

/**
 * 読み上げ同意状態を保存
 */
export function saveVoiceConsent(consented: boolean): void {
  try {
    localStorage.setItem(VOICE_CONSENT_KEY, String(consented));
  } catch {
    // ignore
  }
}
