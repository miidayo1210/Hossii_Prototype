import type { PostFieldConfig } from '../types/settings';

/** 自由入力欄の生文字列をタグ本体に正規化。空白のみは未入力 */
export function normalizeTagInput(raw: string): string | null {
  const trimmed = raw.trim().replace(/^[#＃]+/, '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** タグ必須判定（プリセット選択・確定チップ・入力中の未確定文字列） */
export function hasCommittedTags(
  hashtags: string[],
  selectedPresetTags: string[],
  hashtagInput: string,
): boolean {
  if (selectedPresetTags.length > 0 || hashtags.length > 0) return true;
  return normalizeTagInput(hashtagInput) != null;
}

/** postFields.tags の必須条件を満たしているか */
export function isTagsFieldSatisfied(
  config: PostFieldConfig,
  hashtags: string[],
  selectedPresetTags: string[],
  hashtagInput: string,
): boolean {
  if (!config.enabled || !config.required) return true;
  return hasCommittedTags(hashtags, selectedPresetTags, hashtagInput);
}
