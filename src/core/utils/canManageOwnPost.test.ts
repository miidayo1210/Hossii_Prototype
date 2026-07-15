import { describe, expect, it } from 'vitest';
import { canManageOwnPost } from './canManageOwnPost';

describe('canManageOwnPost', () => {
  const ids = new Set(['h1', 'h2']);

  it('returns true for a logged-in owner when authorship is ready', () => {
    expect(
      canManageOwnPost({
        isAuthenticated: true,
        myAuthorshipIds: ids,
        myAuthorshipIdsStatus: 'ready',
        hossiiId: 'h1',
      }),
    ).toBe(true);
  });

  it('returns false for posts not owned by the current user', () => {
    expect(
      canManageOwnPost({
        isAuthenticated: true,
        myAuthorshipIds: ids,
        myAuthorshipIdsStatus: 'ready',
        hossiiId: 'other',
      }),
    ).toBe(false);
  });

  it('returns false for guests (not authenticated)', () => {
    expect(
      canManageOwnPost({
        isAuthenticated: false,
        myAuthorshipIds: ids,
        myAuthorshipIdsStatus: 'ready',
        hossiiId: 'h1',
      }),
    ).toBe(false);
  });

  it('returns false while authorship is not ready', () => {
    for (const status of ['idle', 'loading', 'error'] as const) {
      expect(
        canManageOwnPost({
          isAuthenticated: true,
          myAuthorshipIds: ids,
          myAuthorshipIdsStatus: status,
          hossiiId: 'h1',
        }),
      ).toBe(false);
    }
  });

  it('returns false for an empty hossii id', () => {
    expect(
      canManageOwnPost({
        isAuthenticated: true,
        myAuthorshipIds: ids,
        myAuthorshipIdsStatus: 'ready',
        hossiiId: '',
      }),
    ).toBe(false);
  });
});
