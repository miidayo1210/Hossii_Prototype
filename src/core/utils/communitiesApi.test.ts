import { describe, expect, it } from 'vitest';
import { pickPrimaryAdminCommunity } from './communitiesApi';

describe('pickPrimaryAdminCommunity', () => {
  it('prefers approved community when admin owns multiple', () => {
    const picked = pickPrimaryAdminCommunity([
      {
        id: 'pending-1',
        admin_id: 'admin',
        name: 'Tmp',
        slug: 'tmp',
        status: 'pending',
        created_at: '2026-07-10T00:00:00.000Z',
      },
      {
        id: 'approved-1',
        admin_id: 'admin',
        name: 'Dev Community',
        slug: 'dev-community',
        status: 'approved',
        created_at: '2026-07-01T00:00:00.000Z',
      },
    ]);
    expect(picked?.id).toBe('approved-1');
  });

  it('returns oldest row when none are approved', () => {
    const picked = pickPrimaryAdminCommunity([
      {
        id: 'b',
        admin_id: 'admin',
        name: 'B',
        slug: 'b',
        status: 'pending',
        created_at: '2026-07-02T00:00:00.000Z',
      },
      {
        id: 'a',
        admin_id: 'admin',
        name: 'A',
        slug: 'a',
        status: 'rejected',
        created_at: '2026-07-01T00:00:00.000Z',
      },
    ]);
    expect(picked?.id).toBe('a');
  });
});
