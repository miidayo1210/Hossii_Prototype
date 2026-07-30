import { describe, expect, it } from 'vitest';
import { canManagePostActions, resolvePostActionActor } from './resolvePostActionActor';

describe('resolvePostActionActor', () => {
  const ids = new Set(['h1']);

  it('prefers own when authorship matches', () => {
    expect(
      resolvePostActionActor({
        isAuthenticated: true,
        isSuperAdmin: true,
        myAuthorshipIds: ids,
        myAuthorshipIdsStatus: 'ready',
        hossiiId: 'h1',
      }),
    ).toBe('own');
  });

  it('returns super_admin for others when caller is super admin', () => {
    expect(
      resolvePostActionActor({
        isAuthenticated: true,
        isSuperAdmin: true,
        myAuthorshipIds: ids,
        myAuthorshipIdsStatus: 'ready',
        hossiiId: 'other',
      }),
    ).toBe('super_admin');
  });

  it('returns null for community admin who is not owner or super', () => {
    expect(
      resolvePostActionActor({
        isAuthenticated: true,
        isSuperAdmin: false,
        myAuthorshipIds: ids,
        myAuthorshipIdsStatus: 'ready',
        hossiiId: 'other',
      }),
    ).toBeNull();
  });

  it('returns null for guests', () => {
    expect(
      canManagePostActions({
        isAuthenticated: false,
        isSuperAdmin: true,
        myAuthorshipIds: ids,
        myAuthorshipIdsStatus: 'ready',
        hossiiId: 'other',
      }),
    ).toBe(false);
  });

  it('allows super_admin while authorship is still loading', () => {
    expect(
      resolvePostActionActor({
        isAuthenticated: true,
        isSuperAdmin: true,
        myAuthorshipIds: new Set(),
        myAuthorshipIdsStatus: 'loading',
        hossiiId: 'x',
      }),
    ).toBe('super_admin');
  });
});
