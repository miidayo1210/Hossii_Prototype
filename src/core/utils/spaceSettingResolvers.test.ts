import { describe, expect, it } from 'vitest';
import type { SpaceSettings } from '../types/settings';
import {
  resolveCanvasExportAllowed,
  resolvePositionSelectorEnabled,
  resolveRandomRecallEnabled,
} from './spaceSettingResolvers';

const baseSettings: SpaceSettings = {
  spaceId: 's1',
  spaceName: 'Test',
  features: {
    likesEnabled: true,
  },
  bubbleEditPermission: 'all',
  bottleFrequency: '3d-7d',
};

describe('resolvePositionSelectorEnabled', () => {
  it('prefers formal posting.positionMode selector', () => {
    expect(
      resolvePositionSelectorEnabled(
        { ...baseSettings, posting: { positionMode: 'selector' } },
        { position_selector: false },
      ),
    ).toBe(true);
  });

  it('prefers formal auto over legacy FF', () => {
    expect(
      resolvePositionSelectorEnabled(
        { ...baseSettings, posting: { positionMode: 'auto' } },
        { position_selector: true },
      ),
    ).toBe(false);
  });
});

describe('resolveRandomRecallEnabled', () => {
  it('prefers formal reflection.randomRecallEnabled', () => {
    expect(
      resolveRandomRecallEnabled(
        { ...baseSettings, reflection: { randomRecallEnabled: true } },
        { random_recall_enabled: false },
      ),
    ).toBe(true);
  });
});

describe('resolveCanvasExportAllowed', () => {
  it('allows admin regardless of flags', () => {
    expect(resolveCanvasExportAllowed(true)).toBe(true);
  });
});
