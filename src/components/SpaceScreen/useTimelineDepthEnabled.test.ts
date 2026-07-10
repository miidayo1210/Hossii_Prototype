import { describe, expect, it, vi } from 'vitest';
import type { SpaceSettings } from '../../core/types/settings';
import { DEFAULT_SPACE_SETTINGS } from '../../core/types/settings';
import {
  getInitialTimelineDepthState,
  getTimelineDepthStateOnSpaceChange,
  isTimelineDepthRequestCurrent,
  loadTimelineDepthEnabledFromDb,
  mergeTimelineDepthIntoLocalStorage,
  shouldFetchTimelineDepthEnabled,
} from '../../core/utils/timelineDepthEnabledLoader';

const baseSettings: SpaceSettings = {
  spaceId: 'space-a',
  spaceName: 'Space A',
  features: { likesEnabled: true },
  bubbleEditPermission: 'all',
  bottleFrequency: '3d-7d',
};

describe('getInitialTimelineDepthState', () => {
  it('starts false with no loading', () => {
    expect(getInitialTimelineDepthState()).toEqual({
      enabled: false,
      isLoading: false,
      error: null,
    });
  });
});

describe('getTimelineDepthStateOnSpaceChange', () => {
  it('resets enabled to false and starts loading', () => {
    expect(getTimelineDepthStateOnSpaceChange()).toEqual({
      enabled: false,
      isLoading: true,
      error: null,
    });
  });
});

describe('isTimelineDepthRequestCurrent', () => {
  it('accepts matching request ids', () => {
    expect(isTimelineDepthRequestCurrent(2, 2)).toBe(true);
  });

  it('rejects stale request ids so a new space is not overwritten', () => {
    expect(isTimelineDepthRequestCurrent(1, 2)).toBe(false);
  });
});

describe('shouldFetchTimelineDepthEnabled', () => {
  it('returns false for undefined, null, and empty id', () => {
    expect(shouldFetchTimelineDepthEnabled(undefined)).toBe(false);
    expect(shouldFetchTimelineDepthEnabled(null)).toBe(false);
    expect(shouldFetchTimelineDepthEnabled('')).toBe(false);
  });

  it('returns true for a non-empty space id', () => {
    expect(shouldFetchTimelineDepthEnabled('space-a')).toBe(true);
  });
});

describe('loadTimelineDepthEnabledFromDb', () => {
  it('returns true when DB setting is true', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ...baseSettings,
      timelineDepthEnabled: true,
    });

    await expect(loadTimelineDepthEnabledFromDb('space-a', 'Space A', fetchFn)).resolves.toEqual({
      enabled: true,
      error: null,
    });
  });

  it('returns false when DB setting is false', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ...baseSettings,
      timelineDepthEnabled: false,
    });

    await expect(loadTimelineDepthEnabledFromDb('space-a', 'Space A', fetchFn)).resolves.toEqual({
      enabled: false,
      error: null,
    });
  });

  it('returns false when row is absent (defaults)', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      spaceId: 'space-a',
      spaceName: 'Space A',
      ...DEFAULT_SPACE_SETTINGS,
    });

    await expect(loadTimelineDepthEnabledFromDb('space-a', 'Space A', fetchFn)).resolves.toEqual({
      enabled: false,
      error: null,
    });
  });

  it('returns false on fetch error', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('network'));

    const result = await loadTimelineDepthEnabledFromDb('space-a', 'Space A', fetchFn);
    expect(result.enabled).toBe(false);
    expect(result.error?.message).toBe('network');
  });

  it('uses DB false even when local intent would be true', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ...baseSettings,
      timelineDepthEnabled: false,
    });

    const result = await loadTimelineDepthEnabledFromDb('space-a', 'Space A', fetchFn);
    expect(result.enabled).toBe(false);
  });

  it('uses DB true even when local intent would be false', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ...baseSettings,
      timelineDepthEnabled: true,
    });

    const result = await loadTimelineDepthEnabledFromDb('space-a', 'Space A', fetchFn);
    expect(result.enabled).toBe(true);
  });
});

describe('mergeTimelineDepthIntoLocalStorage', () => {
  it('merges timelineDepthEnabled without removing other settings', () => {
    const loadFn = vi.fn().mockReturnValue({
      ...baseSettings,
      features: { likesEnabled: false, messagePost: true },
      hossiiColor: '#abc',
    });
    const saveFn = vi.fn();

    mergeTimelineDepthIntoLocalStorage('space-a', 'Space A', true, loadFn, saveFn);

    expect(saveFn).toHaveBeenCalledWith({
      ...baseSettings,
      features: { likesEnabled: false, messagePost: true },
      hossiiColor: '#abc',
      timelineDepthEnabled: true,
    });
  });

  it('overwrites stale local true with DB false for the requested space', () => {
    const loadFn = vi.fn().mockReturnValue({
      ...baseSettings,
      timelineDepthEnabled: true,
    });
    const saveFn = vi.fn();

    mergeTimelineDepthIntoLocalStorage('space-a', 'Space A', false, loadFn, saveFn);

    expect(saveFn).toHaveBeenCalledWith(
      expect.objectContaining({ spaceId: 'space-a', timelineDepthEnabled: false }),
    );
  });

  it('updates only the requested space', () => {
    const spaceBSettings = { ...baseSettings, spaceId: 'space-b', spaceName: 'Space B' };
    const loadFn = vi.fn().mockReturnValue(spaceBSettings);
    const saveFn = vi.fn();

    mergeTimelineDepthIntoLocalStorage('space-b', 'Space B', false, loadFn, saveFn);

    expect(loadFn).toHaveBeenCalledWith('space-b', 'Space B');
    expect(saveFn).toHaveBeenCalledWith({
      ...spaceBSettings,
      timelineDepthEnabled: false,
    });
  });
});
