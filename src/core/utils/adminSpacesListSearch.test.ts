import { describe, expect, it } from 'vitest';
import type { Space } from '../types/space';
import type { OwnerLookupRow } from './personalSpaceOwnerLabelsApi';
import {
  filterPersonalSpacesBySearch,
  normalizeAdminSpacesSearchQuery,
} from './adminSpacesListSearch';

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

describe('normalizeAdminSpacesSearchQuery', () => {
  it('前後空白を除去し小文字化する', () => {
    expect(normalizeAdminSpacesSearchQuery('  Test@Example.COM  ')).toBe('test@example.com');
  });
});

describe('filterPersonalSpacesBySearch', () => {
  const ownerLabels = labels({
    'owner-1': { communityNickname: '田中', adminEmail: 'tanaka@example.test' },
    'owner-2': { communityNickname: '佐藤', adminEmail: 'sato@example.test' },
    'owner-3': { communityNickname: '山田' },
  });

  const fixtures = [
    space({
      id: 'ps-1',
      name: 'マイスペース',
      communityId: 'comm-a',
      spaceType: 'personal',
      ownerUserId: 'owner-1',
    }),
    space({
      id: 'ps-2',
      name: '朝の記録',
      communityId: 'comm-a',
      spaceType: 'personal',
      ownerUserId: 'owner-2',
      isArchived: true,
    }),
    space({
      id: 'ps-3',
      name: '日記スペース',
      communityId: 'comm-a',
      spaceType: 'personal',
      ownerUserId: 'owner-3',
    }),
    space({
      id: 'ps-other',
      name: 'Other Community',
      communityId: 'comm-b',
      spaceType: 'personal',
      ownerUserId: 'owner-x',
    }),
  ];

  it('空クエリは全件を返す', () => {
    const result = filterPersonalSpacesBySearch(fixtures, '', ownerLabels);
    expect(result.map((s) => s.id)).toEqual(['ps-1', 'ps-2', 'ps-3', 'ps-other']);
  });

  it('所有者名で部分一致検索できる', () => {
    const result = filterPersonalSpacesBySearch(fixtures, '田中', ownerLabels);
    expect(result.map((s) => s.id)).toEqual(['ps-1']);
  });

  it('補助 email で部分一致検索できる', () => {
    const result = filterPersonalSpacesBySearch(fixtures, 'sato@example', ownerLabels);
    expect(result.map((s) => s.id)).toEqual(['ps-2']);
  });

  it('スペース名で部分一致検索できる', () => {
    const result = filterPersonalSpacesBySearch(fixtures, '日記', ownerLabels);
    expect(result.map((s) => s.id)).toEqual(['ps-3']);
  });

  it('大文字小文字を区別しない', () => {
    const result = filterPersonalSpacesBySearch(fixtures, 'TANAKA@EXAMPLE', ownerLabels);
    expect(result.map((s) => s.id)).toEqual(['ps-1']);
  });

  it('前後空白を無視する', () => {
    const result = filterPersonalSpacesBySearch(fixtures, '  佐藤  ', ownerLabels);
    expect(result.map((s) => s.id)).toEqual(['ps-2']);
  });

  it('archived も検索対象に含める', () => {
    const result = filterPersonalSpacesBySearch(fixtures, '朝の', ownerLabels);
    expect(result.map((s) => s.id)).toEqual(['ps-2']);
    expect(result[0].isArchived).toBe(true);
  });

  it('0 件のとき空配列を返す', () => {
    const result = filterPersonalSpacesBySearch(fixtures, '存在しない', ownerLabels);
    expect(result).toEqual([]);
  });
});
