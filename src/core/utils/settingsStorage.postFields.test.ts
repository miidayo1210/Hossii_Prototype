import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_POST_FIELD_SETTINGS } from '../types/settings';
import { loadSpaceSettings, saveSpaceSettings } from './settingsStorage';

const storage = new Map<string, string>();

const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
  clear: () => storage.clear(),
};

describe('loadSpaceSettings postFields', () => {
  afterEach(() => {
    storage.clear();
  });

  it('保存した tags.required=true を再読込できる', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      configurable: true,
    });

    saveSpaceSettings({
      spaceId: 'space-1',
      spaceName: 'Test',
      features: { likesEnabled: true },
      bubbleEditPermission: 'all',
      bottleFrequency: '3d-7d',
      postFields: {
        ...DEFAULT_POST_FIELD_SETTINGS,
        tags: { enabled: true, required: true },
      },
    });

    const loaded = loadSpaceSettings('space-1', 'Test');
    expect(loaded.postFields?.tags).toEqual({ enabled: true, required: true });
  });

  it('tags 表示OFFでは required も false に正規化される', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      configurable: true,
    });

    saveSpaceSettings({
      spaceId: 'space-1',
      spaceName: 'Test',
      features: { likesEnabled: true },
      bubbleEditPermission: 'all',
      bottleFrequency: '3d-7d',
      postFields: {
        ...DEFAULT_POST_FIELD_SETTINGS,
        tags: { enabled: false, required: true },
      },
    });

    const loaded = loadSpaceSettings('space-1', 'Test');
    expect(loaded.postFields?.tags).toEqual({ enabled: false, required: false });
  });
});
