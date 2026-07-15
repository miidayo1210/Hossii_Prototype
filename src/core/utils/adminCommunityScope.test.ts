import { describe, expect, it } from 'vitest';
import { resolveSpacesCommunityId } from './adminCommunityScope';

const DEV = { id: 'dev', status: 'approved' as const };
const TMP = { id: 'tmp', status: 'pending' as const };

describe('resolveSpacesCommunityId', () => {
  it('super admin uses override only', () => {
    expect(
      resolveSpacesCommunityId({
        overrideCommunityId: 'any',
        selectedCommunityId: 'dev',
        fallbackCommunityId: 'dev',
        managedCommunities: [DEV],
        isSuperAdmin: true,
      }),
    ).toBe('any');
  });

  it('super admin without override returns null', () => {
    expect(
      resolveSpacesCommunityId({
        overrideCommunityId: null,
        selectedCommunityId: 'dev',
        fallbackCommunityId: 'dev',
        managedCommunities: [DEV],
        isSuperAdmin: true,
      }),
    ).toBeNull();
  });

  it('prefers stored/selected approved community over pending', () => {
    expect(
      resolveSpacesCommunityId({
        overrideCommunityId: null,
        selectedCommunityId: 'dev',
        fallbackCommunityId: null,
        managedCommunities: [TMP, DEV],
        isSuperAdmin: false,
      }),
    ).toBe('dev');
  });

  it('does not auto-select pending when selection is invalid', () => {
    expect(
      resolveSpacesCommunityId({
        overrideCommunityId: null,
        selectedCommunityId: 'tmp',
        fallbackCommunityId: null,
        managedCommunities: [TMP, DEV],
        isSuperAdmin: false,
      }),
    ).toBe('dev');
  });

  it('rejects community id without admin ownership', () => {
    expect(
      resolveSpacesCommunityId({
        overrideCommunityId: null,
        selectedCommunityId: 'foreign',
        fallbackCommunityId: null,
        managedCommunities: [DEV],
        isSuperAdmin: false,
      }),
    ).toBe('dev');
  });

  it('returns null when only pending communities are managed', () => {
    expect(
      resolveSpacesCommunityId({
        overrideCommunityId: null,
        selectedCommunityId: null,
        fallbackCommunityId: null,
        managedCommunities: [TMP],
        isSuperAdmin: false,
      }),
    ).toBeNull();
  });

  it('uses fallbackCommunityId when it is approved and managed', () => {
    expect(
      resolveSpacesCommunityId({
        overrideCommunityId: null,
        selectedCommunityId: null,
        fallbackCommunityId: 'dev',
        managedCommunities: [DEV, TMP],
        isSuperAdmin: false,
      }),
    ).toBe('dev');
  });
});
