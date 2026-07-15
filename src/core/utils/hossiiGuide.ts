import { resolvePackageMessages, isKnownHossiiGuidePackageKey } from '../assets/hossiiGuidePackages';
import type { HossiiGuideSettings } from '../types/settings';
import { DEFAULT_HOSSII_GUIDE_SETTINGS } from '../types/settings';

/** 初回 guideBubble 表示までの待機（117 仕様 15.1） */
export const GUIDE_BUBBLE_INITIAL_DELAY_MS = 1500;

export type HossiiGuideValidationResult =
  | { ok: true; settings: HossiiGuideSettings }
  | { ok: false; message: string };

/** 管理 UI / ストレージ向け draft 初期値 */
export function buildHossiiGuideDraft(
  settings: HossiiGuideSettings | undefined,
): HossiiGuideSettings {
  return {
    ...DEFAULT_HOSSII_GUIDE_SETTINGS,
    ...settings,
    mode: 'package',
  };
}

/** localStorage / JSONB からの部分データを正規化 */
export function normalizeHossiiGuideSettings(
  raw: unknown,
): HossiiGuideSettings | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const obj = raw as Record<string, unknown>;
  const enabled = obj.enabled === true;
  const modeRaw = obj.mode;
  const mode =
    modeRaw === 'package' || modeRaw === 'custom' || modeRaw === 'mixed'
      ? modeRaw
      : DEFAULT_HOSSII_GUIDE_SETTINGS.mode;
  const packageKey = typeof obj.packageKey === 'string' ? obj.packageKey : undefined;
  const customMessages = Array.isArray(obj.customMessages)
    ? obj.customMessages.filter((m): m is string => typeof m === 'string')
    : undefined;

  return {
    enabled,
    mode,
    ...(packageKey !== undefined ? { packageKey } : {}),
    ...(customMessages !== undefined ? { customMessages } : {}),
  };
}

/** 未設定時のフォールバック（利用者向け: OFF 相当） */
export function resolveHossiiGuideSettings(
  settings: HossiiGuideSettings | undefined | null,
): HossiiGuideSettings {
  if (!settings) {
    return { ...DEFAULT_HOSSII_GUIDE_SETTINGS };
  }
  return {
    ...DEFAULT_HOSSII_GUIDE_SETTINGS,
    ...settings,
    mode: settings.mode ?? DEFAULT_HOSSII_GUIDE_SETTINGS.mode,
  };
}

/**
 * Phase 1: パッケージ内メッセージのみ。customMessages は無視（117 13.1）
 */
export function buildGuideMessagePool(guide: HossiiGuideSettings | undefined | null): string[] {
  const resolved = resolveHossiiGuideSettings(guide);
  if (!resolved.enabled) {
    return [];
  }
  if (resolved.mode !== 'package') {
    return [];
  }
  return resolvePackageMessages(resolved.packageKey).filter(isEffectiveGuideMessage);
}

/** trim 後 1 文字以上 */
export function isEffectiveGuideMessage(message: string): boolean {
  return message.trim().length > 0;
}

/** 表示用テキスト整形（117 11.5 / 14.5） */
export function formatGuideMessageText(message: string, maxLength = 120): string {
  const singleLine = message.replace(/[\r\n]+/g, ' ').trim();
  if (singleLine.length <= maxLength) {
    return singleLine;
  }
  return `${singleLine.slice(0, maxLength - 1)}…`;
}

/**
 * 候補プールから 1 件選択（117 13.2）
 * @returns null = 表示しない
 */
export function pickRandomGuideMessage(
  pool: readonly string[],
  random = Math.random,
): string | null {
  if (pool.length === 0) {
    return null;
  }
  if (pool.length === 1) {
    return formatGuideMessageText(pool[0]);
  }
  const index = Math.floor(random() * pool.length);
  const picked = pool[index];
  return picked != null ? formatGuideMessageText(picked) : null;
}

/** 利用者画面向け: 設定から表示候補 1 件を解決 */
export function resolveGuideDisplayMessage(
  guide: HossiiGuideSettings | undefined | null,
  random = Math.random,
): string | null {
  const pool = buildGuideMessagePool(guide);
  return pickRandomGuideMessage(pool, random);
}

/** 管理画面保存時バリデーション（117 18.5） */
export function validateHossiiGuideSettingsForSave(
  guide: HossiiGuideSettings,
): HossiiGuideValidationResult {
  const normalized: HossiiGuideSettings = {
    ...DEFAULT_HOSSII_GUIDE_SETTINGS,
    ...guide,
    mode: 'package',
  };

  if (!normalized.enabled) {
    return { ok: true, settings: normalized };
  }

  if (!normalized.packageKey || normalized.packageKey.trim().length === 0) {
    return { ok: false, message: '言葉のセットを選んでください' };
  }

  if (!isKnownHossiiGuidePackageKey(normalized.packageKey)) {
    return { ok: false, message: '言葉のセットを選び直してください' };
  }

  const pool = buildGuideMessagePool(normalized);
  if (pool.length === 0) {
    return { ok: false, message: '選択したセットに有効な言葉がありません' };
  }

  return { ok: true, settings: normalized };
}

/** 保存済み設定に不正 packageKey があるか（管理 UI 警告用） */
export function hasInvalidStoredPackageKey(
  guide: HossiiGuideSettings | undefined | null,
): boolean {
  if (!guide?.enabled || !guide.packageKey) {
    return false;
  }
  return !isKnownHossiiGuidePackageKey(guide.packageKey);
}
