import { describe, expect, it } from 'vitest';
import type { SpaceSettings } from '../types/settings';
import type { SpacePane } from '../types/spacePane';
import { resolvePanePositionMode } from './resolvePanePositionMode';

const baseSettings: SpaceSettings = {
  spaceId: 'space-1',
  spaceName: 'Test',
  features: { likesEnabled: true },
  bubbleEditPermission: 'all',
  bottleFrequency: '3d-7d',
  posting: { positionMode: 'auto' },
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

describe('resolvePanePositionMode', () => {
  it('returns space posting mode for default pane', () => {
    expect(resolvePanePositionMode(defaultPane, baseSettings)).toBe('auto');
  });

  it('returns pane override for additional pane', () => {
    const pane: SpacePane = {
      ...defaultPane,
      id: 'pane-2',
      isDefault: false,
      settings: { posting: { positionMode: 'selector' } },
    };
    expect(resolvePanePositionMode(pane, baseSettings)).toBe('selector');
  });

  it('inherits when override is null', () => {
    const pane: SpacePane = {
      ...defaultPane,
      id: 'pane-2',
      isDefault: false,
      settings: { posting: { positionMode: null } },
    };
    expect(resolvePanePositionMode(pane, baseSettings)).toBe('auto');
  });
});
