/**
 * マイHossii用の基本プリセット（public/hossii/idle/ の実在画像のみ）
 * Phase 1: コード定義。DBテーブルは使用しない。
 */

export type HossiiPreset = {
  key: string;
  label: string;
  imagePath: string;
};

const IDLE_BASE = '/hossii/idle';

/** 基本Hossiiプリセット一覧（追加時はこの配列へ追記） */
export const HOSSII_BASIC_PRESETS: readonly HossiiPreset[] = [
  { key: 'idle_base', label: 'ほっしー（基本）', imagePath: `${IDLE_BASE}/idle_base.png` },
  { key: 'idle_smile', label: 'ほっしー（にこにこ）', imagePath: `${IDLE_BASE}/idle_smile.png` },
  { key: 'idle_closingeye', label: 'ほっしー（まばたき）', imagePath: `${IDLE_BASE}/idle_closingeye.png` },
] as const;

const PRESET_BY_KEY = new Map(HOSSII_BASIC_PRESETS.map((p) => [p.key, p]));

export function isValidHossiiPresetKey(key: string): boolean {
  return PRESET_BY_KEY.has(key);
}

export function getHossiiPresetByKey(key: string): HossiiPreset | undefined {
  return PRESET_BY_KEY.get(key);
}

export function resolveHossiiPresetImagePath(key: string | null | undefined): string | null {
  if (!key) return null;
  return PRESET_BY_KEY.get(key)?.imagePath ?? null;
}
