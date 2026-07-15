import { describe, expect, it } from 'vitest';
import type { Space } from '../types/space';
import { partitionAdminCommunitySpaces } from './adminSpacesListView';

function space(partial: Partial<Space> & Pick<Space, 'id' | 'name'>): Space {
  return {
    quickEmotions: [],
    createdAt: new Date('2026-01-01'),
    ...partial,
  };
}

describe('partitionAdminCommunitySpaces', () => {
  const commA = 'comm-a';
  const commB = 'comm-b';

  const fixtures = [
    space({ id: 'shared-a', name: 'Shared A', communityId: commA, spaceType: 'shared' }),
    space({ id: 'personal-a', name: '個人', communityId: commA, spaceType: 'personal', ownerUserId: 'u1' }),
    space({ id: 'personal-b', name: '個人B', communityId: commB, spaceType: 'personal', ownerUserId: 'u2' }),
    space({ id: 'legacy', name: 'Legacy', communityId: commA }),
  ];

  it('選択 community の shared / personal を分離する', () => {
    const { sharedSpaces, personalSpaces } = partitionAdminCommunitySpaces(fixtures, commA);
    expect(sharedSpaces.map((s) => s.id)).toEqual(['shared-a', 'legacy']);
    expect(personalSpaces.map((s) => s.id)).toEqual(['personal-a']);
  });

  it('別 community の personal は含めない', () => {
    const { personalSpaces } = partitionAdminCommunitySpaces(fixtures, commA);
    expect(personalSpaces.some((s) => s.id === 'personal-b')).toBe(false);
  });
});
