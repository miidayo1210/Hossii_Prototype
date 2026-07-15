import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => {
  const eqSpy = vi.fn();
  const orderMock = vi.fn();
  const eqMock = vi.fn((col: string, val: unknown) => {
    eqSpy(col, val);
    return { order: orderMock };
  });
  const selectMock = vi.fn(() => ({ eq: eqMock }));
  const fromMock = vi.fn(() => ({ select: selectMock }));
  const getSession = vi.fn();
  return { eqSpy, orderMock, eqMock, selectMock, fromMock, getSession };
});

vi.mock('./../supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: { getSession: h.getSession },
    from: h.fromMock,
  },
}));

import { mapSpaceMembershipRow, fetchMySpaceMemberships } from './spaceMembershipsApi';

describe('mapSpaceMembershipRow', () => {
  it('snake_case 行を camelCase の SpaceMembership へ変換する', () => {
    const mapped = mapSpaceMembershipRow({
      id: 'm1',
      space_id: 'dev-public',
      auth_user_id: 'user-uuid',
      role: 'member',
      status: 'active',
      space_nickname: 'みー',
      joined_at: '2026-07-13T00:00:00Z',
      created_at: '2026-07-13T00:00:00Z',
      updated_at: '2026-07-13T00:00:00Z',
    });

    expect(mapped).toEqual({
      id: 'm1',
      spaceId: 'dev-public',
      authUserId: 'user-uuid',
      role: 'member',
      status: 'active',
      spaceNickname: 'みー',
      joinedAt: '2026-07-13T00:00:00Z',
      createdAt: '2026-07-13T00:00:00Z',
      updatedAt: '2026-07-13T00:00:00Z',
    });
  });

  it('space_nickname が null の場合も保持する', () => {
    const mapped = mapSpaceMembershipRow({
      id: 'm2',
      space_id: 's2',
      auth_user_id: 'u2',
      role: 'admin',
      status: 'suspended',
      space_nickname: null,
      joined_at: '2026-07-13T01:00:00Z',
      created_at: '2026-07-13T01:00:00Z',
      updated_at: '2026-07-13T02:00:00Z',
    });

    expect(mapped.spaceNickname).toBeNull();
    expect(mapped.role).toBe('admin');
    expect(mapped.status).toBe('suspended');
  });
});

describe('fetchMySpaceMemberships', () => {
  beforeEach(() => {
    h.eqSpy.mockClear();
    h.eqMock.mockClear();
    h.fromMock.mockClear();
    h.getSession.mockReset();
    h.orderMock.mockReset();
  });

  it('未ログイン時は空配列を返し、クエリを投げない', async () => {
    h.getSession.mockResolvedValue({ data: { session: null } });
    const rows = await fetchMySpaceMemberships();
    expect(rows).toEqual([]);
    expect(h.fromMock).not.toHaveBeenCalled();
  });

  it('本人の auth_user_id で明示的に絞り込む（RLS だけに依存しない）', async () => {
    h.getSession.mockResolvedValue({ data: { session: { user: { id: 'uid-self' } } } });
    h.orderMock.mockResolvedValue({
      data: [
        {
          id: 'm1',
          space_id: 'dev-space-public',
          auth_user_id: 'uid-self',
          role: 'member',
          status: 'active',
          space_nickname: '本人',
          joined_at: '2026-07-13T00:00:00Z',
          created_at: '2026-07-13T00:00:00Z',
          updated_at: '2026-07-13T00:00:00Z',
        },
      ],
      error: null,
    });

    const rows = await fetchMySpaceMemberships();

    expect(h.fromMock).toHaveBeenCalledWith('space_memberships');
    // 管理者は RLS で他人の membership も見えるため、クエリで本人分に限定する
    expect(h.eqSpy).toHaveBeenCalledWith('auth_user_id', 'uid-self');
    expect(rows).toHaveLength(1);
    expect(rows[0].authUserId).toBe('uid-self');
  });
});
