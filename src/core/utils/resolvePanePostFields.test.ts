import { describe, expect, it } from 'vitest';
import type { SpaceSettings } from '../types/settings';
import type { SpacePane } from '../types/spacePane';
import { resolvePanePostFields } from './resolvePanePostFields';

const baseSettings: SpaceSettings = {
  spaceId: 'space-1',
  spaceName: 'Test',
  features: { likesEnabled: true },
  bubbleEditPermission: 'all',
  bottleFrequency: '3d-7d',
  postFields: {
    message: { enabled: true, required: false },
    emotion: { enabled: false, required: false },
    tags: { enabled: true, required: false },
    photo: { enabled: true, required: false },
    bubbleColor: { enabled: true, required: false },
    bubbleShape: { enabled: true, required: false },
    numberPost: { enabled: false, required: false },
  },
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

const extraPane: SpacePane = {
  ...defaultPane,
  id: 'pane-2',
  isDefault: false,
};

describe('resolvePanePostFields', () => {
  it('returns space settings for default pane', () => {
    const pf = resolvePanePostFields(defaultPane, baseSettings);
    expect(pf.emotion.enabled).toBe(false);
    expect(pf.message.enabled).toBe(true);
  });

  it('returns pane override for additional pane', () => {
    const pane: SpacePane = {
      ...extraPane,
      settings: { postFields: { message: { enabled: false, required: true } } },
    };
    const pf = resolvePanePostFields(pane, baseSettings);
    expect(pf.message).toEqual({ enabled: false, required: false });
    expect(pf.emotion.enabled).toBe(false);
  });

  it('inherits required from space when pane override only sets enabled', () => {
    const pane: SpacePane = {
      ...extraPane,
      settings: { postFields: { tags: { enabled: true } } },
    };
    const settings: SpaceSettings = {
      ...baseSettings,
      postFields: {
        ...baseSettings.postFields!,
        tags: { enabled: true, required: true },
      },
    };
    const pf = resolvePanePostFields(pane, settings);
    expect(pf.tags).toEqual({ enabled: true, required: true });
  });

  it('inherits space when additional pane has null postFields override', () => {
    const pane: SpacePane = { ...extraPane, settings: { postFields: null } };
    expect(resolvePanePostFields(pane, baseSettings).message.enabled).toBe(true);
  });

  it('falls back to space when pane is null', () => {
    expect(resolvePanePostFields(null, baseSettings).message.enabled).toBe(true);
  });
});
