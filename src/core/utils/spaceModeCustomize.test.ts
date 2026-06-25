import { describe, expect, it } from 'vitest';
import type { Space } from '../types/space';
import type { SpaceSettings } from '../types/settings';
import { DEFAULT_POST_FIELD_SETTINGS } from '../types/settings';
import { applySpaceMode } from './spaceModeApply';
import {
  detectModeCustomization,
  extractModeSnapshot,
  refreshModeCustomization,
} from './spaceModeCustomize';

const baseSpace: Space = {
  id: 's1',
  name: 'Test Space',
  quickEmotions: [],
  background: { kind: 'pattern', value: 'mist' },
  createdAt: new Date(),
  isPrivate: false,
};

const baseSettings: SpaceSettings = {
  spaceId: 's1',
  spaceName: 'Test Space',
  features: {
    likesEnabled: true,
  },
  bubbleEditPermission: 'all',
  bottleFrequency: '3d-7d',
  postFields: DEFAULT_POST_FIELD_SETTINGS,
  posting: { positionMode: 'auto' },
  reflection: { randomRecallEnabled: false },
};

describe('extractModeSnapshot', () => {
  it('captures mode-controlled fields', () => {
    const snapshot = extractModeSnapshot(baseSpace, baseSettings);
    expect(snapshot.isPrivate).toBe(false);
    expect(snapshot.likesEnabled).toBe(true);
    expect(snapshot.positionMode).toBe('auto');
    expect(snapshot.postFields.message.enabled).toBe(true);
  });
});

describe('detectModeCustomization', () => {
  it('returns false when snapshot matches current', () => {
    const { nextSpace, nextSettings } = applySpaceMode('reflection', baseSpace, baseSettings);
    expect(detectModeCustomization(nextSpace, nextSettings, nextSettings.mode!)).toBe(false);
  });

  it('returns true when settings diverge from snapshot', () => {
    const { nextSpace, nextSettings } = applySpaceMode('reflection', baseSpace, baseSettings);
    const modified: SpaceSettings = {
      ...nextSettings,
      features: { ...nextSettings.features, likesEnabled: true },
    };
    expect(detectModeCustomization(nextSpace, modified, nextSettings.mode!)).toBe(true);
  });

  it('returns false when no snapshot', () => {
    expect(
      detectModeCustomization(baseSpace, baseSettings, {
        appliedMode: 'custom',
        isCustomized: false,
      }),
    ).toBe(false);
  });
});

describe('refreshModeCustomization', () => {
  it('updates isCustomized when settings changed after apply', () => {
    const { nextSpace, nextSettings } = applySpaceMode('reflection', baseSpace, baseSettings);
    const modifiedSpace = { ...nextSpace, isPrivate: false };
    const refreshed = refreshModeCustomization(modifiedSpace, nextSettings);
    expect(refreshed?.isCustomized).toBe(true);
  });

  it('returns undefined when already in sync', () => {
    const { nextSpace, nextSettings } = applySpaceMode('reflection', baseSpace, baseSettings);
    expect(refreshModeCustomization(nextSpace, nextSettings)).toBeUndefined();
  });
});
