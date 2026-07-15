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

import {
  updateMyHossii,
  setMyHossiiVisibility,
  softDeleteMyHossii,
} from './myHossiiMutationsApi';

describe('myHossiiMutationsApi', () => {
  beforeEach(() => {
    supabaseMock.configured = true;
    supabaseMock.rpc.mockReset();
  });

  describe('when Supabase is not configured', () => {
    beforeEach(() => {
      supabaseMock.configured = false;
    });

    it('updateMyHossii fails safely without calling rpc', async () => {
      const res = await updateMyHossii('h1', 'x');
      expect(res).toEqual({ ok: false, message: 'Supabase is not configured' });
      expect(supabaseMock.rpc).not.toHaveBeenCalled();
    });

    it('setMyHossiiVisibility fails safely without calling rpc', async () => {
      const res = await setMyHossiiVisibility('h1', 'owner_only');
      expect(res.ok).toBe(false);
      expect(supabaseMock.rpc).not.toHaveBeenCalled();
    });

    it('softDeleteMyHossii fails safely without calling rpc', async () => {
      const res = await softDeleteMyHossii('h1');
      expect(res.ok).toBe(false);
      expect(supabaseMock.rpc).not.toHaveBeenCalled();
    });
  });

  describe('updateMyHossii', () => {
    it('passes only p_hossii_id and p_message (no auth_user_id / role)', async () => {
      const iso = '2026-07-13T12:00:00.000Z';
      supabaseMock.rpc.mockResolvedValue({ data: iso, error: null });
      const res = await updateMyHossii('h1', 'new body');
      expect(supabaseMock.rpc).toHaveBeenCalledWith('update_my_hossii', {
        p_hossii_id: 'h1',
        p_message: 'new body',
      });
      const args = supabaseMock.rpc.mock.calls[0][1] as Record<string, unknown>;
      expect(Object.keys(args)).toEqual(['p_hossii_id', 'p_message']);
      expect(res).toEqual({ ok: true, contentEditedAt: new Date(iso) });
    });

    it('returns contentEditedAt null when rpc returns no data', async () => {
      supabaseMock.rpc.mockResolvedValue({ data: null, error: null });
      const res = await updateMyHossii('h1', 'x');
      expect(res).toEqual({ ok: true, contentEditedAt: null });
    });

    it('propagates rpc error as ok:false', async () => {
      supabaseMock.rpc.mockResolvedValue({
        data: null,
        error: { message: 'not owned', code: 'P0001' },
      });
      const res = await updateMyHossii('h1', 'x');
      expect(res).toEqual({ ok: false, message: 'not owned', code: 'P0001' });
    });
  });

  describe('setMyHossiiVisibility', () => {
    it('passes visibility value through and no identity args', async () => {
      supabaseMock.rpc.mockResolvedValue({ data: null, error: null });
      const res = await setMyHossiiVisibility('h9', 'public');
      expect(supabaseMock.rpc).toHaveBeenCalledWith('set_my_hossii_visibility', {
        p_hossii_id: 'h9',
        p_visibility: 'public',
      });
      expect(res).toEqual({ ok: true });
    });

    it('propagates rpc error', async () => {
      supabaseMock.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
      const res = await setMyHossiiVisibility('h9', 'owner_only');
      expect(res.ok).toBe(false);
    });
  });

  describe('softDeleteMyHossii', () => {
    it('passes only p_hossii_id', async () => {
      supabaseMock.rpc.mockResolvedValue({ data: null, error: null });
      const res = await softDeleteMyHossii('h5');
      expect(supabaseMock.rpc).toHaveBeenCalledWith('soft_delete_my_hossii', {
        p_hossii_id: 'h5',
      });
      expect(res).toEqual({ ok: true });
    });

    it('propagates rpc error', async () => {
      supabaseMock.rpc.mockResolvedValue({ data: null, error: { message: 'already deleted' } });
      const res = await softDeleteMyHossii('h5');
      expect(res).toEqual({ ok: false, message: 'already deleted', code: undefined });
    });
  });
});
