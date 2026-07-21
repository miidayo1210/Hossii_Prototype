import { describe, expect, it } from 'vitest';
import {
  buildCanonicalSpaceScreenHref,
  isCanonicalOrLegacySpacePath,
  resolveCommunitySlugForSpace,
  shouldReplaceWithCanonicalSpacePath,
} from './spaceScreenRoute';

describe('spaceScreenRoute', () => {
  it('builds canonical href with hash', () => {
    expect(
      buildCanonicalSpaceScreenHref({
        communitySlug: 'dev-community',
        spaceUrl: 'dev-public',
      }),
    ).toBe('/c/dev-community/s/dev-public#screen');
  });

  it('resolves community slug from memberships', () => {
    expect(
      resolveCommunitySlugForSpace(
        { communityId: 'c1' },
        [{ communityId: 'c1', communitySlug: 'frogs' }],
      ),
    ).toBe('frogs');
  });

  it('detects legacy root path as replace target', () => {
    expect(
      shouldReplaceWithCanonicalSpacePath('/', '/c/frogs/s/main'),
    ).toBe(true);
    expect(
      shouldReplaceWithCanonicalSpacePath('/s/main', '/c/frogs/s/main'),
    ).toBe(true);
    expect(
      shouldReplaceWithCanonicalSpacePath('/c/frogs/s/main', '/c/frogs/s/main'),
    ).toBe(false);
  });

  it('recognizes canonical and legacy space paths', () => {
    expect(isCanonicalOrLegacySpacePath('/c/a/s/b')).toBe(true);
    expect(isCanonicalOrLegacySpacePath('/s/b')).toBe(true);
    expect(isCanonicalOrLegacySpacePath('/')).toBe(false);
  });

  it('builds canonical href with custom hash', () => {
    expect(
      buildCanonicalSpaceScreenHref({
        communitySlug: 'dev-community',
        spaceUrl: 'dev-public',
        hash: '#account',
      }),
    ).toBe('/c/dev-community/s/dev-public#account');
  });
});
