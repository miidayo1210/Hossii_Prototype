import { describe, expect, it } from 'vitest';
import type { SpacePane } from '../types/spacePane';
import {
  buildTabBarGroupPatch,
  computeVisiblePaneReorderUpdates,
  resolveInsertBeforeVisibleIndex,
  splitPanesByTabBarGroup,
} from './spacePaneTabBar';

const now = new Date();

function pane(overrides: Partial<SpacePane> & Pick<SpacePane, 'id'>): SpacePane {
  return {
    spaceId: 'space-1',
    name: 'Tab',
    slug: 'tab',
    sortOrder: 0,
    isDefault: false,
    isVisible: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('computeVisiblePaneReorderUpdates', () => {
  const all = [
    pane({ id: 'a', sortOrder: 0, isDefault: true }),
    pane({ id: 'h', sortOrder: 1, isVisible: false }),
    pane({ id: 'c', sortOrder: 2 }),
    pane({ id: 'd', sortOrder: 3 }),
  ];
  const visible = all.filter((p) => p.isVisible);

  it('returns empty when dropping at same position', () => {
    expect(computeVisiblePaneReorderUpdates(all, visible, 'c', 1)).toEqual([]);
  });

  it('reorders visible tabs while keeping hidden pane slot', () => {
    expect(computeVisiblePaneReorderUpdates(all, visible, 'd', 1)).toEqual([
      { id: 'a', sortOrder: 0 },
      { id: 'h', sortOrder: 1 },
      { id: 'd', sortOrder: 2 },
      { id: 'c', sortOrder: 3 },
    ]);
  });

  it('moves visible tab to end among visible tabs', () => {
    expect(computeVisiblePaneReorderUpdates(all, visible, 'a', 3)).toEqual([
      { id: 'c', sortOrder: 0 },
      { id: 'h', sortOrder: 1 },
      { id: 'd', sortOrder: 2 },
      { id: 'a', sortOrder: 3 },
    ]);
  });
});

describe('resolveInsertBeforeVisibleIndex', () => {
  const visible = [
    pane({ id: 'a', sortOrder: 0 }),
    pane({ id: 'b', sortOrder: 1 }),
  ];
  const rects = new Map<string, DOMRect>([
    ['a', { left: 0, width: 100 } as DOMRect],
    ['b', { left: 100, width: 100 } as DOMRect],
  ]);

  it('inserts before first tab when pointer is on left half', () => {
    expect(resolveInsertBeforeVisibleIndex(visible, rects, 40)).toBe(0);
  });

  it('inserts before second tab when pointer is on right half of first tab', () => {
    expect(resolveInsertBeforeVisibleIndex(visible, rects, 70)).toBe(1);
  });

  it('inserts after last tab when pointer is past midpoint of last tab', () => {
    expect(resolveInsertBeforeVisibleIndex(visible, rects, 170)).toBe(2);
  });
});

describe('splitPanesByTabBarGroup', () => {
  it('splits bar and basket panes by settings.tabBar.group', () => {
    const visible = [
      pane({ id: 'a', sortOrder: 0 }),
      pane({ id: 'b', sortOrder: 1, settings: { tabBar: { group: 'basket' } } }),
      pane({ id: 'c', sortOrder: 2 }),
    ];
    const { barPanes, basketPanes } = splitPanesByTabBarGroup(visible);
    expect(barPanes.map((p) => p.id)).toEqual(['a', 'c']);
    expect(basketPanes.map((p) => p.id)).toEqual(['b']);
  });
});

describe('buildTabBarGroupPatch', () => {
  it('sets basket group in settings', () => {
    const p = pane({ id: 'x', settings: { postFields: { message: { visible: true } } } });
    expect(buildTabBarGroupPatch(p, 'basket').settings?.tabBar?.group).toBe('basket');
  });

  it('clears tabBar when returning to bar', () => {
    const p = pane({
      id: 'x',
      settings: { tabBar: { group: 'basket' } },
    });
    expect(buildTabBarGroupPatch(p, 'bar').settings?.tabBar).toBeUndefined();
  });
});
