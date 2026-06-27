import { describe, expect, it } from 'vitest';
import type { SpacePane } from '../types/spacePane';
import {
  MAX_SPACE_PANES,
  canCreatePane,
  canHidePane,
  computeReorderUpdates,
  sortPanesForDisplay,
  validatePaneName,
  validatePaneSlug,
} from './spacePaneManagement';

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

describe('canCreatePane', () => {
  it('allows when under limit', () => {
    expect(canCreatePane(19)).toBe(true);
  });

  it('denies at limit', () => {
    expect(canCreatePane(MAX_SPACE_PANES)).toBe(false);
  });
});

describe('canHidePane', () => {
  it('denies default pane', () => {
    expect(canHidePane(pane({ id: 'd', isDefault: true }))).toBe(false);
  });

  it('allows non-default pane', () => {
    expect(canHidePane(pane({ id: 'x', isDefault: false }))).toBe(true);
  });
});

describe('validatePaneName', () => {
  it('rejects empty', () => {
    expect(validatePaneName('  ')).not.toBeNull();
  });

  it('accepts valid name', () => {
    expect(validatePaneName('今日の問い')).toBeNull();
  });
});

describe('validatePaneSlug', () => {
  const existing = [
    pane({ id: 'a', slug: 'main', isVisible: true }),
    pane({ id: 'b', slug: 'hidden-old', isVisible: false }),
  ];

  it('rejects duplicate including hidden pane slug', () => {
    expect(validatePaneSlug('hidden-old', existing, 'c')).toBeTruthy();
  });

  it('allows same slug for self', () => {
    expect(validatePaneSlug('main', existing, 'a')).toBeNull();
  });

  it('rejects invalid format', () => {
    expect(validatePaneSlug('Bad Slug', existing)).toBeTruthy();
  });
});

describe('sortPanesForDisplay', () => {
  it('sorts by sortOrder then id', () => {
    const panes = [
      pane({ id: 'b', sortOrder: 1 }),
      pane({ id: 'a', sortOrder: 0 }),
      pane({ id: 'c', sortOrder: 1 }),
    ];
    expect(sortPanesForDisplay(panes).map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('computeReorderUpdates', () => {
  const panes = [
    pane({ id: 'a', sortOrder: 0 }),
    pane({ id: 'b', sortOrder: 1 }),
    pane({ id: 'c', sortOrder: 2 }),
  ];

  it('returns empty at top when moving up', () => {
    expect(computeReorderUpdates(panes, 'a', 'up')).toEqual([]);
  });

  it('returns empty at bottom when moving down', () => {
    expect(computeReorderUpdates(panes, 'c', 'down')).toEqual([]);
  });

  it('swaps with neighbor and reindexes', () => {
    expect(computeReorderUpdates(panes, 'b', 'up')).toEqual([
      { id: 'b', sortOrder: 0 },
      { id: 'a', sortOrder: 1 },
      { id: 'c', sortOrder: 2 },
    ]);
  });
});
