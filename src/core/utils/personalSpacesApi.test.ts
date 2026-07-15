import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => {
  const rpc = vi.fn();
  const getSession = vi.fn();
  return { rpc, getSession };
});

vi.mock('./../supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: { getSession: h.getSession },
    rpc: h.rpc,
  },
}));

import {
  mapCommunityPersonalSpaceRow,
  fetchMyCommunityPersonalSpaces,
  ensureMyPersonalSpace,
} from './personalSpacesApi';

describe('mapCommunityPersonalSpaceRow', () => {
  it('snake_case 行を camelCase へ変換する（未作成は null）', () => {
    expect(
      mapCommunityPersonalSpaceRow({
        community_id: 'c1',
        community_name: 'Frogs',
        membership_status: 'active',
        personal_space_id: null,
        personal_space_url: null,
        personal_space_status: null,
      }),
    ).toEqual({
      communityId: 'c1',
      communityName: 'Frogs',
      membershipStatus: 'active',
      personalSpaceId: null,
      personalSpaceUrl: null,
      personalSpaceStatus: null,
    });
  });
});

describe('fetchMyCommunityPersonalSpaces', () => {
  beforeEach(() => {
    h.rpc.mockReset();
    h.getSession.mockReset();
  });

  it('未ログイン時は空配列を返し RPC を呼ばない', async () => {
    h.getSession.mockResolvedValue({ data: { session: null } });
    expect(await fetchMyCommunityPersonalSpaces()).toEqual([]);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it('ログイン時は list_my_community_personal_spaces を呼び変換して返す', async () => {
    h.getSession.mockResolvedValue({ data: { session: { user: { id: 'uid' } } } });
    h.rpc.mockResolvedValue({
      data: [
        { community_id: 'c1', community_name: 'Frogs', membership_status: 'active', personal_space_id: 'ps-1', personal_space_url: 'p-abc', personal_space_status: 'active' },
      ],
      error: null,
    });
    const rows = await fetchMyCommunityPersonalSpaces();
    expect(h.rpc).toHaveBeenCalledWith('list_my_community_personal_spaces');
    expect(rows).toHaveLength(1);
    expect(rows[0].personalSpaceId).toBe('ps-1');
  });

  it('RPC エラー時は throw する', async () => {
    h.getSession.mockResolvedValue({ data: { session: { user: { id: 'uid' } } } });
    h.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(fetchMyCommunityPersonalSpaces()).rejects.toThrow(/boom/);
  });
});

describe('ensureMyPersonalSpace', () => {
  beforeEach(() => {
    h.rpc.mockReset();
  });

  it('成功時は spaceId / spaceUrl を返す（配列レスポンス）', async () => {
    h.rpc.mockResolvedValue({ data: [{ space_id: 'ps-1', space_url: 'p-abc' }], error: null });
    const res = await ensureMyPersonalSpace('c1');
    expect(h.rpc).toHaveBeenCalledWith('ensure_my_personal_space', { p_community_id: 'c1' });
    expect(res).toEqual({ ok: true, spaceId: 'ps-1', spaceUrl: 'p-abc' });
  });

  it('RPC エラー（権限なし等）時は ok:false を返す', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: 'not an active member', code: 'P0001' } });
    const res = await ensureMyPersonalSpace('c1');
    expect(res).toEqual({ ok: false, message: 'not an active member', code: 'P0001' });
  });

  it('communityId が空なら ok:false（RPC を呼ばない）', async () => {
    const res = await ensureMyPersonalSpace('');
    expect(res.ok).toBe(false);
    expect(h.rpc).not.toHaveBeenCalled();
  });
});
