import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => {
  const rpc = vi.fn();
  const getSession = vi.fn();
  const fetchMyCommunityMemberships = vi.fn();
  return { rpc, getSession, fetchMyCommunityMemberships };
});

vi.mock('./../supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: { getSession: h.getSession },
    rpc: h.rpc,
  },
}));

vi.mock('./communityMembershipsApi', () => ({
  fetchMyCommunityMemberships: h.fetchMyCommunityMemberships,
}));

vi.mock('./spaceArchiveApi', () => ({
  fetchSpaceArchiveFlags: vi.fn(async (ids: string[]) => {
    const map = new Map<string, boolean>();
    for (const id of ids) {
      if (id === 'ps-archived') map.set(id, true);
    }
    return map;
  }),
}));

import {
  mapCommunityPersonalSpaceRow,
  fetchMyCommunityPersonalSpaces,
  fetchAccountCommunityPersonalSpaces,
  ensureMyPersonalSpace,
  fetchPersonalSpaceForStore,
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

describe('fetchAccountCommunityPersonalSpaces', () => {
  beforeEach(() => {
    h.rpc.mockReset();
    h.getSession.mockReset();
    h.fetchMyCommunityMemberships.mockReset();
    h.getSession.mockResolvedValue({ data: { session: { user: { id: 'uid' } } } });
  });

  it('active community ごとに role を付与して返す', async () => {
    h.rpc.mockResolvedValue({
      data: [
        { community_id: 'c1', community_name: 'A', membership_status: 'active', personal_space_id: null, personal_space_url: null, personal_space_status: null },
        { community_id: 'c2', community_name: 'B', membership_status: 'active', personal_space_id: 'ps-2', personal_space_url: 'p-b', personal_space_status: 'active' },
      ],
      error: null,
    });
    h.fetchMyCommunityMemberships.mockResolvedValue([
      { communityId: 'c1', communityName: 'A', role: 'admin', status: 'active', communityNickname: null },
      { communityId: 'c2', communityName: 'B', role: 'member', status: 'active', communityNickname: null },
    ]);

    const rows = await fetchAccountCommunityPersonalSpaces();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ communityId: 'c1', membershipRole: 'admin', personalSpaceId: null, personalSpaceIsArchived: false });
    expect(rows[1]).toMatchObject({ communityId: 'c2', membershipRole: 'member', personalSpaceId: 'ps-2', personalSpaceIsArchived: false });
  });

  it('is_archived を personalSpaceIsArchived として付与する', async () => {
    h.rpc.mockResolvedValue({
      data: [
        { community_id: 'c1', community_name: 'A', membership_status: 'active', personal_space_id: 'ps-archived', personal_space_url: 'p-a', personal_space_status: 'active' },
      ],
      error: null,
    });
    h.fetchMyCommunityMemberships.mockResolvedValue([
      { communityId: 'c1', communityName: 'A', role: 'member', status: 'active', communityNickname: null },
    ]);

    const rows = await fetchAccountCommunityPersonalSpaces();
    expect(rows[0].personalSpaceIsArchived).toBe(true);
  });

  it('pending / suspended / removed は除外する', async () => {
    h.rpc.mockResolvedValue({
      data: [
        { community_id: 'c-active', community_name: 'Active', membership_status: 'active', personal_space_id: null, personal_space_url: null, personal_space_status: null },
        { community_id: 'c-suspended', community_name: 'Suspended', membership_status: 'suspended', personal_space_id: null, personal_space_url: null, personal_space_status: null },
      ],
      error: null,
    });
    h.fetchMyCommunityMemberships.mockResolvedValue([
      { communityId: 'c-active', communityName: 'Active', role: 'member', status: 'active', communityNickname: null },
      { communityId: 'c-suspended', communityName: 'Suspended', role: 'member', status: 'suspended', communityNickname: null },
    ]);

    const rows = await fetchAccountCommunityPersonalSpaces();
    expect(rows).toHaveLength(1);
    expect(rows[0].communityId).toBe('c-active');
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

describe('fetchPersonalSpaceForStore', () => {
  it('spaceUrl が null なら null を返し fetch を呼ばない', async () => {
    const fetchFn = vi.fn();
    expect(await fetchPersonalSpaceForStore(null, fetchFn)).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('spaceUrl があるとき fetchFn の結果を返す', async () => {
    const space = { id: 'ps-1', name: '個人', quickEmotions: [], createdAt: new Date() };
    const fetchFn = vi.fn(async () => space);
    expect(await fetchPersonalSpaceForStore('p-abc', fetchFn)).toBe(space);
    expect(fetchFn).toHaveBeenCalledWith('p-abc');
  });
});
