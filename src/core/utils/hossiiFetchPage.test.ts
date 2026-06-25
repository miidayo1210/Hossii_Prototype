import { describe, expect, it } from 'vitest';
import type { Hossii } from '../types';
import {
  compareHossiiNewestFirst,
  cursorFromOldest,
  isOlderThanCursor,
  mergeHossiiListsUnique,
  sortHossiisNewestFirst,
} from './hossiiFetchPage';

function h(id: string, iso: string): Hossii {
  return {
    id,
    message: id,
    spaceId: 's1',
    createdAt: new Date(iso),
    origin: 'manual',
  };
}

describe('hossiiFetchPage', () => {
  it('sorts by created_at DESC then id DESC', () => {
    const items = [
      h('b', '2024-01-01T12:00:00.000Z'),
      h('a', '2024-01-01T12:00:00.000Z'),
      h('c', '2024-01-02T00:00:00.000Z'),
    ];
    const sorted = sortHossiisNewestFirst(items);
    expect(sorted.map((x) => x.id)).toEqual(['c', 'b', 'a']);
  });

  it('same created_at: no duplicate when paging with cursor', () => {
    const same = '2024-06-01T10:00:00.000Z';
    const page1 = [h('id-3', same), h('id-2', same)];
    const cursor = cursorFromOldest(page1)!;
    expect(cursor).toEqual({ createdAt: same, id: 'id-2' });

    const page2Candidates = [h('id-1', same), h('id-0', same)];
    const page2 = page2Candidates.filter((item) => isOlderThanCursor(item, cursor));
    expect(page2.map((x) => x.id)).toEqual(['id-1', 'id-0']);

    const merged = mergeHossiiListsUnique(page1, page2);
    expect(merged.map((x) => x.id)).toEqual(['id-3', 'id-2', 'id-1', 'id-0']);
    expect(merged).toHaveLength(4);
  });

  it('compareHossiiNewestFirst is consistent', () => {
    const a = h('z', '2024-01-01T00:00:00.000Z');
    const b = h('a', '2024-01-01T00:00:00.000Z');
    expect(compareHossiiNewestFirst(a, b)).toBeLessThan(0);
    expect(compareHossiiNewestFirst(b, a)).toBeGreaterThan(0);
  });
});
