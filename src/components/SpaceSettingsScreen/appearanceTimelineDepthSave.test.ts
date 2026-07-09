import { describe, expect, it } from 'vitest';
import type { SpaceSettings } from '../../core/types/settings';
import {
  isTimelineDepthDirty,
  mergeTimelineDepthIntoSettings,
  readTimelineDepthDraft,
  shouldPersistTimelineDepth,
} from './appearanceTimelineDepthSave';

const baseSettings: SpaceSettings = {
  spaceId: 's1',
  spaceName: 'Test',
  features: { likesEnabled: true },
  bubbleEditPermission: 'all',
  bottleFrequency: '3d-7d',
};

describe('readTimelineDepthDraft', () => {
  it('returns true when DB setting is true', () => {
    expect(readTimelineDepthDraft({ ...baseSettings, timelineDepthEnabled: true })).toBe(true);
  });

  it('returns false when DB setting is false', () => {
    expect(readTimelineDepthDraft({ ...baseSettings, timelineDepthEnabled: false })).toBe(false);
  });

  it('returns false when key is absent', () => {
    expect(readTimelineDepthDraft(baseSettings)).toBe(false);
  });

  it('returns false for undefined settings', () => {
    expect(readTimelineDepthDraft(undefined)).toBe(false);
  });
});

describe('isTimelineDepthDirty', () => {
  it('detects OFF to ON', () => {
    expect(isTimelineDepthDirty(true, { ...baseSettings, timelineDepthEnabled: false })).toBe(true);
  });

  it('detects ON to OFF', () => {
    expect(isTimelineDepthDirty(false, { ...baseSettings, timelineDepthEnabled: true })).toBe(true);
  });

  it('is false when unchanged', () => {
    expect(isTimelineDepthDirty(false, { ...baseSettings, timelineDepthEnabled: false })).toBe(false);
  });
});

describe('shouldPersistTimelineDepth', () => {
  it('calls API only when manager can edit and value is dirty', () => {
    expect(shouldPersistTimelineDepth(true, { ...baseSettings, timelineDepthEnabled: false }, true)).toBe(true);
    expect(shouldPersistTimelineDepth(true, { ...baseSettings, timelineDepthEnabled: false }, false)).toBe(false);
    expect(shouldPersistTimelineDepth(false, { ...baseSettings, timelineDepthEnabled: false }, true)).toBe(false);
  });
});

describe('mergeTimelineDepthIntoSettings', () => {
  it('sets timelineDepthEnabled without touching other fields', () => {
    const merged = mergeTimelineDepthIntoSettings(
      { ...baseSettings, starMarkerType: 'pin', timelineDepthEnabled: false },
      true,
    );
    expect(merged.timelineDepthEnabled).toBe(true);
    expect(merged.starMarkerType).toBe('pin');
    expect(merged.features.likesEnabled).toBe(true);
  });
});
