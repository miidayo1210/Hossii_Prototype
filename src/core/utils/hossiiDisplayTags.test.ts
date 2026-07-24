import { describe, expect, it } from 'vitest';
import {
  collectHossiiDisplayTags,
  MAX_VISIBLE_HOSSII_TAGS,
  sliceVisibleHossiiTags,
} from './hossiiDisplayTags';

describe('collectHossiiDisplayTags', () => {
  it('returns empty for null/undefined/empty', () => {
    expect(collectHossiiDisplayTags({ tags: null, hashtags: null })).toEqual([]);
    expect(collectHossiiDisplayTags({ tags: undefined, hashtags: undefined })).toEqual([]);
    expect(collectHossiiDisplayTags({ tags: [], hashtags: [] })).toEqual([]);
  });

  it('merges tags and hashtags with kinds', () => {
    expect(
      collectHossiiDisplayTags({ tags: ['質問'], hashtags: ['自由'] }),
    ).toEqual([
      { label: '質問', kind: 'preset' },
      { label: '自由', kind: 'free' },
    ]);
  });

  it('dedupes identical strings preferring preset', () => {
    expect(
      collectHossiiDisplayTags({ tags: ['同じ'], hashtags: ['同じ', '別'] }),
    ).toEqual([
      { label: '同じ', kind: 'preset' },
      { label: '別', kind: 'free' },
    ]);
  });

  it('handles tags-only and hashtags-only', () => {
    expect(collectHossiiDisplayTags({ tags: ['A'], hashtags: null })).toEqual([
      { label: 'A', kind: 'preset' },
    ]);
    expect(collectHossiiDisplayTags({ tags: null, hashtags: ['B'] })).toEqual([
      { label: 'B', kind: 'free' },
    ]);
  });
});

describe('sliceVisibleHossiiTags', () => {
  it('caps at MAX_VISIBLE_HOSSII_TAGS and reports +N', () => {
    const tags = [
      { label: 'a', kind: 'preset' as const },
      { label: 'b', kind: 'free' as const },
      { label: 'c', kind: 'free' as const },
    ];
    const { visible, extraCount } = sliceVisibleHossiiTags(tags);
    expect(MAX_VISIBLE_HOSSII_TAGS).toBe(2);
    expect(visible).toHaveLength(2);
    expect(extraCount).toBe(1);
  });

  it('returns zero extra when within limit', () => {
    expect(sliceVisibleHossiiTags(['x']).extraCount).toBe(0);
    expect(sliceVisibleHossiiTags(['x', 'y']).extraCount).toBe(0);
  });
});
