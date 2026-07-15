import { describe, expect, it } from 'vitest';
import { buildJoinedSpaces } from './joinedSpacesApi';
import type { SpaceMembership } from '../types/spaceMembership';

function membership(over: Partial<SpaceMembership> & { id: string; spaceId: string }): SpaceMembership {
  return {
    id: over.id,
    spaceId: over.spaceId,
    authUserId: 'me',
    role: over.role ?? 'member',
    status: over.status ?? 'active',
    spaceNickname: over.spaceNickname ?? null,
    joinedAt: over.joinedAt ?? '2026-07-01T00:00:00.000Z',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  };
}

describe('buildJoinedSpaces', () => {
  it('maps membership + space + community into display model', () => {
    const result = buildJoinedSpaces(
      [membership({ id: 'm1', spaceId: 's1', spaceNickname: 'にっく' })],
      [{ id: 's1', name: 'スペース1', space_url: 'space-1', community_id: 'c1' }],
      [{ id: 'c1', name: 'コミュA' }],
    );
    expect(result).toEqual([
      {
        membershipId: 'm1',
        spaceId: 's1',
        spaceNickname: 'にっく',
        joinedAt: '2026-07-01T00:00:00.000Z',
        spaceName: 'スペース1',
        spaceUrl: 'space-1',
        communityName: 'コミュA',
        isArchived: false,
      },
    ]);
  });

  it('falls back to null name/url when the space is missing (deleted)', () => {
    const result = buildJoinedSpaces([membership({ id: 'm1', spaceId: 'gone' })], [], []);
    expect(result[0].spaceName).toBeNull();
    expect(result[0].spaceUrl).toBeNull();
    expect(result[0].communityName).toBeNull();
    expect(result[0].isArchived).toBe(false);
  });

  it('leaves communityName null when space has no community or community not found', () => {
    const result = buildJoinedSpaces(
      [membership({ id: 'm1', spaceId: 's1' })],
      [{ id: 's1', name: 'S', space_url: null, community_id: null }],
      [{ id: 'c1', name: 'C' }],
    );
    expect(result[0].communityName).toBeNull();
    expect(result[0].spaceUrl).toBeNull();
  });

  it('excludes non-active memberships (removed / suspended / invited)', () => {
    const result = buildJoinedSpaces(
      [
        membership({ id: 'm1', spaceId: 's1', status: 'active' }),
        membership({ id: 'm2', spaceId: 's2', status: 'removed' }),
        membership({ id: 'm3', spaceId: 's3', status: 'suspended' }),
        membership({ id: 'm4', spaceId: 's4', status: 'invited' }),
      ],
      [
        { id: 's1', name: 'S1', space_url: 'a', community_id: null },
        { id: 's2', name: 'S2', space_url: 'b', community_id: null },
        { id: 's3', name: 'S3', space_url: 'c', community_id: null },
        { id: 's4', name: 'S4', space_url: 'd', community_id: null },
      ],
      [],
    );
    expect(result.map((r) => r.membershipId)).toEqual(['m1']);
  });

  it('does not expose role / status / auth_user_id in the model', () => {
    const result = buildJoinedSpaces(
      [membership({ id: 'm1', spaceId: 's1', role: 'owner' })],
      [{ id: 's1', name: 'S', space_url: 'a', community_id: null }],
      [],
    );
    expect(Object.keys(result[0]).sort()).toEqual(
      [
        'communityName',
        'isArchived',
        'joinedAt',
        'membershipId',
        'spaceId',
        'spaceName',
        'spaceNickname',
        'spaceUrl',
      ].sort(),
    );
  });
});
