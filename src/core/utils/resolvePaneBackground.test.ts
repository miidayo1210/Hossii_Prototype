import { describe, expect, it } from 'vitest';
import type { Space } from '../types/space';
import type { SpacePane } from '../types/spacePane';
import { resolvePaneBackground } from './resolvePaneBackground';

const spaceBg = { kind: 'color' as const, value: '#EAF4FF' };
const paneBg = { kind: 'pattern' as const, value: 'dots' as const };

const baseSpace: Space = {
  id: 'space-1',
  name: 'Test',
  spaceURL: 'test-space',
  background: spaceBg,
  createdAt: new Date(),
};

const defaultPane: SpacePane = {
  id: 'space-1-pane-default',
  spaceId: 'space-1',
  name: 'メイン',
  slug: 'main',
  sortOrder: 0,
  isDefault: true,
  isVisible: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const extraPane: SpacePane = {
  ...defaultPane,
  id: 'pane-2',
  name: 'Ideas',
  slug: 'ideas',
  isDefault: false,
};

describe('resolvePaneBackground', () => {
  it('returns space background for default pane even when pane.background is set', () => {
    const pane = { ...defaultPane, background: paneBg };
    expect(resolvePaneBackground(pane, baseSpace)).toEqual(spaceBg);
  });

  it('returns pane override for non-default pane with pool image', () => {
    const poolUrl = 'https://example.com/pool.jpg';
    const space = { ...baseSpace, savedBackgroundImages: [poolUrl] };
    const pane = {
      ...extraPane,
      background: { kind: 'image' as const, value: poolUrl, source: 'cloud' as const },
    };
    expect(resolvePaneBackground(pane, space)).toEqual(pane.background);
  });

  it('falls back to space background when extra pane has null background', () => {
    const pane = { ...extraPane, background: null };
    expect(resolvePaneBackground(pane, baseSpace)).toEqual(spaceBg);
  });

  it('returns undefined when space is missing', () => {
    expect(resolvePaneBackground(defaultPane, null)).toBeUndefined();
  });

  it('returns space background when pane is null', () => {
    expect(resolvePaneBackground(null, baseSpace)).toEqual(spaceBg);
  });

  it('falls back to space background when extra pane has non-image override', () => {
    const pane = { ...extraPane, background: paneBg };
    expect(resolvePaneBackground(pane, baseSpace)).toEqual(spaceBg);
  });

  it('falls back to space background when image URL is not in pool', () => {
    const pane = {
      ...extraPane,
      background: {
        kind: 'image' as const,
        value: 'https://example.com/removed.jpg',
        source: 'cloud' as const,
      },
    };
    expect(resolvePaneBackground(pane, baseSpace)).toEqual(spaceBg);
  });
});
