import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('./../supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { rpc: h.rpc },
}));

import { superAdminCreateCommunity } from './communitiesApi';

describe('superAdminCreateCommunity', () => {
  beforeEach(() => {
    h.rpc.mockReset();
  });

  it('calls RPC with trimmed name', async () => {
    h.rpc.mockResolvedValue({
      data: {
        id: 'c1',
        admin_id: 'u1',
        name: 'New Community',
        slug: 'abc12345',
        status: 'approved',
        created_at: '2026-07-24T00:00:00.000Z',
      },
      error: null,
    });

    const result = await superAdminCreateCommunity('  New Community  ');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.community.id).toBe('c1');
      expect(result.community.name).toBe('New Community');
      expect(result.community.status).toBe('approved');
    }
    expect(h.rpc).toHaveBeenCalledWith('super_admin_create_community', {
      p_name: 'New Community',
    });
  });

  it('rejects whitespace-only name without RPC', async () => {
    const result = await superAdminCreateCommunity('   ');
    expect(result.ok).toBe(false);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it('returns ok:false on RPC error without exposing message', async () => {
    h.rpc.mockResolvedValue({
      data: null,
      error: { message: 'not authorized' },
    });

    const result = await superAdminCreateCommunity('Test');
    expect(result).toEqual({ ok: false });
  });
});
