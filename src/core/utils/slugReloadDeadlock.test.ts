import { describe, expect, it } from 'vitest';
import type { Space } from '../types';
import {
  isSlugUrlStillResolving,
  shouldResetSlugHandlingOnAuthRestore,
} from './slugUrlResolution';

/** SET_SPACES reducer の preserveIds マージ（fetch 前クリア時の退避確認用） */
function mergeSpacesWithPreserveIds(
  currentSpaces: Space[],
  incomingSpaces: Space[],
  preserveIds: Set<string>,
): Space[] {
  const mergedSpaces = [...incomingSpaces];
  if (preserveIds.size > 0) {
    const supabaseIds = new Set(incomingSpaces.map((s) => s.id));
    const pendingSpaces = currentSpaces.filter(
      (s) => preserveIds.has(s.id) && !supabaseIds.has(s.id),
    );
    mergedSpaces.push(...pendingSpaces);
  }
  return mergedSpaces;
}

const slugSpace: Space = {
  id: 'space-slug-1',
  name: 'Slug Space',
  spaceURL: 'dev-public',
  communityId: 'community-1',
  quickEmotions: [],
  createdAt: new Date('2026-01-01'),
};

const slugResolvingBase = {
  isOnSlugPath: true,
  slugFetchOutcome: 'hit' as const,
  slugFromPath: 'dev-public',
  hasSlugSpaceInStore: false,
  slugAccessPending: false,
  spaceURLNotFound: false,
  guestSpaceId: null,
  guestSpaceIsPrivate: false,
};

describe('slug reload deadlock prevention', () => {
  it('preserves slug-resolved space through SET_SPACES [] clear', () => {
    const afterClear = mergeSpacesWithPreserveIds(
      [slugSpace],
      [],
      new Set([slugSpace.id]),
    );
    expect(afterClear).toHaveLength(1);
    expect(afterClear[0]?.spaceURL).toBe('dev-public');
  });

  it('does not permanently load when slug space survives fetchSpaces clear', () => {
    expect(isSlugUrlStillResolving(slugResolvingBase)).toBe(true);

    expect(
      isSlugUrlStillResolving({
        ...slugResolvingBase,
        hasSlugSpaceInStore: true,
      }),
    ).toBe(false);
  });

  it('reaches terminal state when slug fetch misses', () => {
    expect(
      isSlugUrlStillResolving({
        ...slugResolvingBase,
        slugFetchOutcome: 'miss',
      }),
    ).toBe(false);
  });

  it('reaches terminal state when slug fetch rejects (outcome miss)', () => {
    expect(
      isSlugUrlStillResolving({
        ...slugResolvingBase,
        slugFetchOutcome: 'miss',
        hasSlugSpaceInStore: false,
      }),
    ).toBe(false);
  });

  it('allows slug re-handling after auth restores on slug path', () => {
    expect(shouldResetSlugHandlingOnAuthRestore(null, { uid: 'u1' }, true)).toBe(true);
    expect(shouldResetSlugHandlingOnAuthRestore({ uid: 'u1' }, { uid: 'u1' }, true)).toBe(
      false,
    );
    expect(shouldResetSlugHandlingOnAuthRestore(null, { uid: 'u1' }, false)).toBe(false);
  });

  it('does not block guest slug flow (guestSpaceId exits resolving)', () => {
    expect(
      isSlugUrlStillResolving({
        ...slugResolvingBase,
        guestSpaceId: slugSpace.id,
      }),
    ).toBe(false);
  });

  it('does not exit resolving on hit alone without slug space in store', () => {
    expect(
      isSlugUrlStillResolving({
        ...slugResolvingBase,
        slugFetchOutcome: 'hit',
        hasSlugSpaceInStore: false,
        slugAccessPending: false,
      }),
    ).toBe(true);
  });
});
