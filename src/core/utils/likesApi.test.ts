import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  configured: true,
  rpc: vi.fn(),
}));

vi.mock('../supabase', () => ({
  get isSupabaseConfigured() {
    return supabaseMock.configured;
  },
  supabase: {
    rpc: (name: string, args: unknown) => supabaseMock.rpc(name, args),
  },
}));

import { incrementLike } from './likesApi';

describe('incrementLike (Phase 2D-1 privacy-hardened RPC)', () => {
  beforeEach(() => {
    supabaseMock.configured = true;
    supabaseMock.rpc.mockReset();
  });

  it('returns the new count for a likeable (public) post', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: 7, error: null });
    await expect(incrementLike('h1')).resolves.toBe(7);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('increment_hossii_like', { p_hossii_id: 'h1' });
  });

  it('maps NULL (owner_only/deleted/non-existent → not likeable) to 0 without leaking', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: null, error: null });
    await expect(incrementLike('hidden-or-missing')).resolves.toBe(0);
  });

  it('returns 0 on error (no PII propagated to caller)', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(incrementLike('h1')).resolves.toBe(0);
  });

  it('returns 0 when Supabase is not configured (no rpc call)', async () => {
    supabaseMock.configured = false;
    await expect(incrementLike('h1')).resolves.toBe(0);
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });
});
