import { describe, expect, it } from 'vitest';
import type { Space } from '../types/space';
import type { SpacePane } from '../types/spacePane';
import { resolvePaneDecorations } from './resolvePaneDecorations';

const deco = {
  id: 'd1',
  type: 'sign' as const,
  position: { x: 50, y: 50 },
  content: { body: 'hello' },
};

const baseSpace: Space = {
  id: 'space-1',
  name: 'Test',
  spaceURL: 'test',
  decorations: [deco],
  createdAt: new Date(),
};

const defaultPane: SpacePane = {
  id: 'pane-default',
  spaceId: 'space-1',
  name: 'Main',
  slug: 'main',
  sortOrder: 0,
  isDefault: true,
  isVisible: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('resolvePaneDecorations', () => {
  it('returns space decorations for default pane', () => {
    expect(resolvePaneDecorations(defaultPane, baseSpace)).toEqual([deco]);
  });

  it('returns pane override for additional pane', () => {
    const paneDeco = { ...deco, id: 'd2', content: { body: 'pane' } };
    const pane: SpacePane = {
      ...defaultPane,
      id: 'pane-2',
      isDefault: false,
      decorations: [paneDeco],
    };
    expect(resolvePaneDecorations(pane, baseSpace)).toEqual([paneDeco]);
  });

  it('inherits when pane decorations is null', () => {
    const pane: SpacePane = {
      ...defaultPane,
      id: 'pane-2',
      isDefault: false,
      decorations: null,
    };
    expect(resolvePaneDecorations(pane, baseSpace)).toEqual([deco]);
  });

  it('allows empty override array', () => {
    const pane: SpacePane = {
      ...defaultPane,
      id: 'pane-2',
      isDefault: false,
      decorations: [],
    };
    expect(resolvePaneDecorations(pane, baseSpace)).toEqual([]);
  });
});
