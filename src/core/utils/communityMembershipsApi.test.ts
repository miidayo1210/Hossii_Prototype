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
  mapMyCommunityMembershipRow,
  fetchMyCommunityMemberships,
  addCommunityMember,
} from './communityMembershipsApi';

describe('mapMyCommunityMembershipRow', () => {
  it('snake_case 行を camelCase の MyCommunityMembership へ変換する', () => {
    const mapped = mapMyCommunityMembershipRow({
      community_id: 'c1',
      community_name: 'Frogs',
      community_slug: 'frogs',
      community_description: 'Test community',
      role: 'member',
      status: 'active',
      community_nickname: 'FrogUser',
    });
    expect(mapped).toEqual({
      communityId: 'c1',
      communityName: 'Frogs',
      communitySlug: 'frogs',
      communityDescription: 'Test community',
      role: 'member',
      status: 'active',
      communityNickname: 'FrogUser',
    });
  });
});

describe('fetchMyCommunityMemberships', () => {
  beforeEach(() => {
    h.rpc.mockReset();
    h.getSession.mockReset();
  });

  it('未ログイン時は空配列を返し、RPC を呼ばない', async () => {
    h.getSession.mockResolvedValue({ data: { session: null } });
    const rows = await fetchMyCommunityMemberships();
    expect(rows).toEqual([]);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it('ログイン時は list_my_community_memberships を呼び、変換して返す', async () => {
    h.getSession.mockResolvedValue({ data: { session: { user: { id: 'uid' } } } });
    h.rpc.mockResolvedValue({
      data: [{
        community_id: 'c1',
        community_name: 'Frogs',
        community_slug: null,
        community_description: null,
        role: 'member',
        status: 'active',
        community_nickname: null,
      }],
      error: null,
    });
    const rows = await fetchMyCommunityMemberships();
    expect(h.rpc).toHaveBeenCalledWith('list_my_community_memberships');
    expect(rows).toHaveLength(1);
    expect(rows[0].communityName).toBe('Frogs');
  });

  it('RPC エラー時は throw する', async () => {
    h.getSession.mockResolvedValue({ data: { session: { user: { id: 'uid' } } } });
    h.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(fetchMyCommunityMemberships()).rejects.toThrow(/boom/);
  });
});

describe('addCommunityMember', () => {
  beforeEach(() => {
    h.rpc.mockReset();
  });

  it('RPC に community_id / auth_user_id / role を渡す', async () => {
    h.rpc.mockResolvedValue({ data: null, error: null });
    const res = await addCommunityMember('c1', 'u2', 'member');
    expect(res.ok).toBe(true);
    expect(h.rpc).toHaveBeenCalledWith('admin_add_community_member', {
      p_community_id: 'c1',
      p_auth_user_id: 'u2',
      p_role: 'member',
    });
  });

  it('RPC エラー時は ok:false を返す（例外を投げない）', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: 'not authorized', code: 'P0001' } });
    const res = await addCommunityMember('c1', 'u2');
    expect(res).toEqual({ ok: false, message: 'not authorized', code: 'P0001' });
  });
});
