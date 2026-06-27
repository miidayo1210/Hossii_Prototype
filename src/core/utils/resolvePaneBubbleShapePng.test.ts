import { describe, expect, it } from 'vitest';
import type { Space } from '../types/space';
import type { SpacePane } from '../types/spacePane';
import { resolvePaneBubbleShapePng, hasPaneBubbleShapeOverride } from './resolvePaneBubbleShapePng';

const baseSpace: Space = {
  id: 'space-1',
  name: 'Test',
  spaceURL: 'test',
  bubbleShapePng: '/assets/bubble-shapes/speech.png',
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

describe('resolvePaneBubbleShapePng', () => {
  it('returns space shape for default pane', () => {
    expect(resolvePaneBubbleShapePng(defaultPane, baseSpace)).toBe('/assets/bubble-shapes/speech.png');
  });

  it('returns pane override', () => {
    const pane: SpacePane = {
      ...defaultPane,
      id: 'pane-2',
      isDefault: false,
      bubbleShapePng: '/custom.png',
    };
    expect(resolvePaneBubbleShapePng(pane, baseSpace)).toBe('/custom.png');
  });

  it('inherits when null', () => {
    const pane: SpacePane = {
      ...defaultPane,
      id: 'pane-2',
      isDefault: false,
      bubbleShapePng: null,
    };
    expect(resolvePaneBubbleShapePng(pane, baseSpace)).toBe('/assets/bubble-shapes/speech.png');
    expect(hasPaneBubbleShapeOverride(pane)).toBe(false);
  });

  it('detects explicit override including empty string', () => {
    const pane: SpacePane = {
      ...defaultPane,
      id: 'pane-2',
      isDefault: false,
      bubbleShapePng: '',
    };
    expect(hasPaneBubbleShapeOverride(pane)).toBe(true);
    expect(resolvePaneBubbleShapePng(pane, baseSpace)).toBeUndefined();
  });
});
