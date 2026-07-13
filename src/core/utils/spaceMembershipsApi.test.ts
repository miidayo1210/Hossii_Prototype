import { describe, it, expect } from 'vitest';
import { mapSpaceMembershipRow } from './spaceMembershipsApi';

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
