/** スペース表示用: プリセット tags と自由入力 hashtags の和集合（重複除去） */

export type HossiiDisplayTagKind = 'preset' | 'free';

export type HossiiDisplayTag = {
  label: string;
  kind: HossiiDisplayTagKind;
};

export const MAX_VISIBLE_HOSSII_TAGS = 2;

type TagFields = {
  tags?: string[] | null;
  hashtags?: string[] | null;
};

/**
 * `tags` ∪ `hashtags`。同一文字列は1件（preset を優先）。
 * null / 空配列でも安全。
 */
export function collectHossiiDisplayTags(hossii: TagFields): HossiiDisplayTag[] {
  const result: HossiiDisplayTag[] = [];
  const seen = new Set<string>();

  for (const tag of hossii.tags ?? []) {
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    result.push({ label: tag, kind: 'preset' });
  }
  for (const tag of hossii.hashtags ?? []) {
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    result.push({ label: tag, kind: 'free' });
  }
  return result;
}

export function sliceVisibleHossiiTags<T>(
  tags: T[],
  max: number = MAX_VISIBLE_HOSSII_TAGS,
): { visible: T[]; extraCount: number } {
  return {
    visible: tags.slice(0, max),
    extraCount: Math.max(0, tags.length - max),
  };
}
