import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('./../supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { rpc: h.rpc },
}));

import { checkCanAccessSpace } from './spaceAccessApi';

describe('checkCanAccessSpace', () => {
  beforeEach(() => h.rpc.mockReset());

  it('RPC が true なら true', async () => {
    h.rpc.mockResolvedValue({ data: true, error: null });
    expect(await checkCanAccessSpace('s1')).toBe(true);
    expect(h.rpc).toHaveBeenCalledWith('can_access_space', { p_space_id: 's1' });
  });

  it('RPC エラー時は false', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: 'denied' } });
    expect(await checkCanAccessSpace('s1')).toBe(false);
  });

  it('spaceId が空なら false（RPC を呼ばない）', async () => {
    expect(await checkCanAccessSpace('')).toBe(false);
    expect(h.rpc).not.toHaveBeenCalled();
  });
});
