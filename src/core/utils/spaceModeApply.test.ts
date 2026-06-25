import { describe, expect, it } from 'vitest';
import type { Space } from '../types/space';
import type { SpaceSettings } from '../types/settings';
import { DEFAULT_POST_FIELD_SETTINGS } from '../types/settings';
import { applySpaceMode, buildModeDiff, buildModeTarget } from './spaceModeApply';

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

describe('buildModeTarget', () => {
  it('reflection sets private, disables likes, enables random recall', () => {
    const { space, settings } = buildModeTarget('reflection', baseSpace, baseSettings);
    expect(space.isPrivate).toBe(true);
    expect(settings.features.likesEnabled).toBe(false);
    expect(settings.posting?.positionMode).toBe('auto');
    expect(settings.reflection?.randomRecallEnabled).toBe(true);
    expect(settings.bubbleEditPermission).toBe('owner_and_admin');
  });

  it('workshop requires message but keeps emotion enabled from current', () => {
    const settingsWithEmotionOff: SpaceSettings = {
      ...baseSettings,
      postFields: {
        ...DEFAULT_POST_FIELD_SETTINGS,
        emotion: { enabled: false, required: false },
      },
      features: { ...baseSettings.features, emotionPost: false },
    };
    const { settings } = buildModeTarget('workshop', baseSpace, settingsWithEmotionOff);
    expect(settings.postFields?.message).toEqual({ enabled: true, required: true });
    expect(settings.postFields?.emotion?.enabled).toBe(false);
    expect(settings.features.messagePost).toBe(true);
    expect(settings.features.numberPost).toBe(true);
  });
});

describe('buildModeDiff', () => {
  it('lists changes when applying reflection from plaza defaults', () => {
    const { space: targetSpace, settings: targetSettings } = buildModeTarget(
      'reflection',
      baseSpace,
      baseSettings,
    );
    const diff = buildModeDiff(baseSpace, baseSettings, targetSpace, targetSettings);
    const labels = diff.map((d) => d.label);
    expect(labels).toContain('公開範囲');
    expect(labels).toContain('いいね');
    expect(labels).toContain('過去の投稿との出会い');
    expect(labels).toContain('投稿の編集権限');
  });

  it('returns empty diff when target equals current', () => {
    const { space, settings } = buildModeTarget('plaza', baseSpace, {
      ...baseSettings,
      posting: { positionMode: 'selector' },
      reflection: { randomRecallEnabled: false },
    });
    const diff = buildModeDiff(space, settings, space, settings);
    expect(diff).toHaveLength(0);
  });
});

describe('applySpaceMode', () => {
  it('sets mode state with snapshot and syncs legacy features', () => {
    const { nextSpace, nextSettings } = applySpaceMode('reflection', baseSpace, baseSettings);
    expect(nextSpace.isPrivate).toBe(true);
    expect(nextSettings.mode?.appliedMode).toBe('reflection');
    expect(nextSettings.mode?.isCustomized).toBe(false);
    expect(nextSettings.mode?.appliedAt).toBeTruthy();
    expect(nextSettings.mode?.snapshot?.isPrivate).toBe(true);
    expect(nextSettings.features.messagePost).toBe(
      nextSettings.mode?.snapshot?.postFields.message.enabled,
    );
  });
});
