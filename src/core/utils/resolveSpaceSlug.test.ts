import { describe, it, expect } from 'vitest';
import { resolveSpaceSlug } from './resolveSpaceSlug';

describe('resolveSpaceSlug', () => {
  const spaces = [
    { id: 'dev-space-public', spaceURL: 'dev-public' },
    { id: 's2', spaceURL: 'another-space' },
  ];

  it('state.spaces の spaceURL を最優先で返す', () => {
    expect(
      resolveSpaceSlug({ spaceId: 'dev-space-public', spaces, pathname: '/s/whatever' }),
    ).toBe('dev-public');
  });

  it('state に無い場合はレガシー /s/[slug] パスから拾う', () => {
    expect(
      resolveSpaceSlug({ spaceId: 'unknown', spaces, pathname: '/s/dev-public' }),
    ).toBe('dev-public');
  });

  it('state に無い場合はコミュニティ /c/[c]/s/[slug] パスから拾う', () => {
    expect(
      resolveSpaceSlug({ spaceId: null, spaces, pathname: '/c/my-community/s/team-space' }),
    ).toBe('team-space');
  });

  it('どこからも解決できなければ null', () => {
    expect(
      resolveSpaceSlug({ spaceId: 'unknown', spaces, pathname: '/somewhere/else' }),
    ).toBeNull();
  });

  it('spaceURL が空/未設定なら URL フォールバックを使う', () => {
    const noUrl = [{ id: 's3', spaceURL: null }];
    expect(
      resolveSpaceSlug({ spaceId: 's3', spaces: noUrl, pathname: '/s/fallback-space' }),
    ).toBe('fallback-space');
  });
});
