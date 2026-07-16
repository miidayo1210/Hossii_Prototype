import { describe, expect, it } from 'vitest';
import type { Space } from '../types/space';
import type { OwnerLookupRow } from './personalSpaceOwnerLabelsApi';
import { sortPersonalSpaces, sortSharedSpaces } from './adminSpacesListSort';

function space(partial: Partial<Space> & Pick<Space, 'id' | 'name'>): Space {
  return {
    quickEmotions: [],
    createdAt: new Date('2026-01-01'),
    ...partial,
  };
}

function labels(
  entries: Record<string, Partial<OwnerLookupRow>>,
): Map<string, OwnerLookupRow> {
  const map = new Map<string, OwnerLookupRow>();
  for (const [id, row] of Object.entries(entries)) {
    map.set(id, {
      communityNickname: null,
      profileNickname: null,
      participantDisplayName: null,
      adminEmail: null,
      ...row,
    });
  }
  return map;
}

describe('sortSharedSpaces', () => {
  const fixtures = [
    space({ id: 's1', name: 'Zebra', createdAt: new Date('2026-01-01'), isArchived: true }),
    space({ id: 's2', name: 'Alpha', createdAt: new Date('2026-03-01') }),
    space({ id: 's3', name: 'Beta', createdAt: new Date('2026-02-01') }),
  ];

  it('current は入力順を維持する', () => {
    expect(sortSharedSpaces(fixtures, 'current').map((s) => s.id)).toEqual(['s1', 's2', 's3']);
  });

  it('作成が新しい順', () => {
    expect(sortSharedSpaces(fixtures, 'created_desc').map((s) => s.id)).toEqual(['s2', 's3', 's1']);
  });

  it('名前順', () => {
    expect(sortSharedSpaces(fixtures, 'name_asc').map((s) => s.id)).toEqual(['s2', 's3', 's1']);
  });

  it('アーカイブを下へ（同グループ内は作成が古い順）', () => {
    expect(sortSharedSpaces(fixtures, 'archived_last').map((s) => s.id)).toEqual(['s3', 's2', 's1']);
  });
});

describe('sortPersonalSpaces', () => {
  const ownerLabels = labels({
    'u1': { communityNickname: '山田' },
    'u2': { communityNickname: '佐藤' },
    'u3': { communityNickname: '田中' },
  });

  const fixtures = [
    space({
      id: 'p1',
      name: 'Cスペース',
      createdAt: new Date('2026-01-01'),
      ownerUserId: 'u1',
      isArchived: true,
      spaceType: 'personal',
    }),
    space({
      id: 'p2',
      name: 'Aスペース',
      createdAt: new Date('2026-03-01'),
      ownerUserId: 'u2',
      spaceType: 'personal',
    }),
    space({
      id: 'p3',
      name: 'Bスペース',
      createdAt: new Date('2026-02-01'),
      ownerUserId: 'u3',
      spaceType: 'personal',
    }),
  ];

  it('current は入力順を維持する', () => {
    expect(sortPersonalSpaces(fixtures, 'current', ownerLabels).map((s) => s.id)).toEqual([
      'p1',
      'p2',
      'p3',
    ]);
  });

  it('所有者名順', () => {
    expect(sortPersonalSpaces(fixtures, 'owner_asc', ownerLabels).map((s) => s.id)).toEqual([
      'p2',
      'p1',
      'p3',
    ]);
  });

  it('作成が新しい順', () => {
    expect(sortPersonalSpaces(fixtures, 'created_desc', ownerLabels).map((s) => s.id)).toEqual([
      'p2',
      'p3',
      'p1',
    ]);
  });

  it('スペース名順', () => {
    expect(sortPersonalSpaces(fixtures, 'name_asc', ownerLabels).map((s) => s.id)).toEqual([
      'p2',
      'p3',
      'p1',
    ]);
  });

  it('アーカイブを下へ（同グループ内は所有者名順）', () => {
    expect(sortPersonalSpaces(fixtures, 'archived_last', ownerLabels).map((s) => s.id)).toEqual([
      'p2',
      'p3',
      'p1',
    ]);
  });

  it('ownerLabels 未取得時は名前未設定としてソートする', () => {
    const unknown = [
      space({ id: 'x1', name: 'X', ownerUserId: 'unknown', spaceType: 'personal' }),
      space({ id: 'x2', name: 'Y', ownerUserId: 'u3', spaceType: 'personal' }),
    ];
    expect(sortPersonalSpaces(unknown, 'owner_asc', ownerLabels).map((s) => s.id)).toEqual([
      'x2',
      'x1',
    ]);
  });
});
