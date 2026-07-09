import { describe, expect, it } from 'vitest';
import type { SpaceSettings } from '../types/settings';
import { resolveTimelineDepthEnabled } from './resolveTimelineDepthEnabled';

const baseSettings: SpaceSettings = {
  spaceId: 's1',
  spaceName: 'Test',
  features: { likesEnabled: true },
  bubbleEditPermission: 'all',
  bottleFrequency: '3d-7d',
};

describe('resolveTimelineDepthEnabled', () => {
  it('returns true when explicitly true', () => {
    expect(resolveTimelineDepthEnabled({ ...baseSettings, timelineDepthEnabled: true })).toBe(true);
  });

  it('returns false when explicitly false', () => {
    expect(resolveTimelineDepthEnabled({ ...baseSettings, timelineDepthEnabled: false })).toBe(false);
  });

  it('returns false for undefined settings', () => {
    expect(resolveTimelineDepthEnabled(undefined)).toBe(false);
  });

  it('returns false when key is absent', () => {
    expect(resolveTimelineDepthEnabled(baseSettings)).toBe(false);
  });
});
