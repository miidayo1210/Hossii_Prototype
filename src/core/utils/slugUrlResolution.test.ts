import { describe, expect, it } from 'vitest';
import {
  isSlugUrlStillResolving,
  parseSpaceSlugFromPathname,
  shouldResetSlugHandlingOnAuthRestore,
} from './slugUrlResolution';

describe('parseSpaceSlugFromPathname', () => {
  it('parses legacy /s/[slug]', () => {
    expect(parseSpaceSlugFromPathname('/s/morning-team')).toBe('morning-team');
  });

  it('parses /c/[community]/s/[slug]', () => {
    expect(parseSpaceSlugFromPathname('/c/my-community/s/morning-team')).toBe(
      'morning-team',
    );
  });
});

describe('isSlugUrlStillResolving', () => {
  const base = {
    isOnSlugPath: true,
    slugFetchOutcome: 'loading' as const,
    slugFromPath: 'morning-team',
    hasSlugSpaceInStore: false,
    slugAccessPending: false,
    spaceURLNotFound: false,
    guestSpaceId: null,
    guestSpaceIsPrivate: false,
  };

  it('is true while slug fetch is loading', () => {
    expect(isSlugUrlStillResolving(base)).toBe(true);
  });

  it('is true while access check is pending', () => {
    expect(
      isSlugUrlStillResolving({
        ...base,
        slugFetchOutcome: 'hit',
        hasSlugSpaceInStore: true,
        slugAccessPending: true,
      }),
    ).toBe(true);
  });

  it('is true when slug fetch hit but space is not in store yet', () => {
    expect(
      isSlugUrlStillResolving({
        ...base,
        slugFetchOutcome: 'hit',
      }),
    ).toBe(true);
  });

  it('is false when slug space is resolved', () => {
    expect(
      isSlugUrlStillResolving({
        ...base,
        slugFetchOutcome: 'hit',
        hasSlugSpaceInStore: true,
      }),
    ).toBe(false);
  });

  it('is false when slug fetch missed', () => {
    expect(
      isSlugUrlStillResolving({
        ...base,
        slugFetchOutcome: 'miss',
      }),
    ).toBe(false);
  });

  it('is false for non-slug paths', () => {
    expect(
      isSlugUrlStillResolving({
        ...base,
        isOnSlugPath: false,
      }),
    ).toBe(false);
  });
});

describe('shouldResetSlugHandlingOnAuthRestore', () => {
  it('is true when auth restores on slug path', () => {
    expect(shouldResetSlugHandlingOnAuthRestore(null, { uid: 'user-1' }, true)).toBe(true);
  });

  it('is false when already logged in or not on slug path', () => {
    expect(shouldResetSlugHandlingOnAuthRestore({ uid: 'user-1' }, { uid: 'user-1' }, true)).toBe(
      false,
    );
    expect(shouldResetSlugHandlingOnAuthRestore(null, { uid: 'user-1' }, false)).toBe(false);
    expect(shouldResetSlugHandlingOnAuthRestore(null, null, true)).toBe(false);
  });
});
