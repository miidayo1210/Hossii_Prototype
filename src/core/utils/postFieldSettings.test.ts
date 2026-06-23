import { describe, expect, it } from 'vitest';
import type { SpaceSettings } from '../types/settings';
import { DEFAULT_POST_FIELD_SETTINGS, DEFAULT_SPACE_FEATURES } from '../types/settings';
import {
  applyPostFieldChange,
  allPostFieldsDisabled,
  mergePostFieldSettings,
  resolvePostFields,
} from './postFieldSettings';

const baseSettings: SpaceSettings = {
  spaceId: 's1',
  spaceName: 'Test',
  features: { ...DEFAULT_SPACE_FEATURES },
  cardType: 'constellation',
  hossiiColor: 'pink',
  bubbleEditPermission: 'all',
  bottleFrequency: '3d-7d',
};

describe('resolvePostFields', () => {
  it('returns defaults when settings is null', () => {
    expect(resolvePostFields(null)).toEqual(DEFAULT_POST_FIELD_SETTINGS);
  });

  it('derives enabled from legacy features when postFields missing', () => {
    const pf = resolvePostFields({
      ...baseSettings,
      features: {
        ...DEFAULT_SPACE_FEATURES,
        commentPost: false,
        numberPost: true,
      },
    });
    expect(pf.message.enabled).toBe(false);
    expect(pf.numberPost.enabled).toBe(true);
    expect(pf.tags.enabled).toBe(true);
    expect(pf.message.required).toBe(false);
  });

  it('prefers postFields when present', () => {
    const pf = resolvePostFields({
      ...baseSettings,
      postFields: {
        ...DEFAULT_POST_FIELD_SETTINGS,
        message: { enabled: false, required: true },
      },
    });
    expect(pf.message.enabled).toBe(false);
    expect(pf.message.required).toBe(false);
  });
});

describe('mergePostFieldSettings', () => {
  it('fills partial keys from defaults', () => {
    const pf = mergePostFieldSettings({ message: { enabled: false, required: false } });
    expect(pf.emotion.enabled).toBe(true);
    expect(pf.message.enabled).toBe(false);
  });
});

describe('applyPostFieldChange', () => {
  it('clears required when enabled is turned off', () => {
    const withRequired = {
      ...baseSettings,
      postFields: {
        ...DEFAULT_POST_FIELD_SETTINGS,
        photo: { enabled: true, required: true },
      },
    };
    const updated = applyPostFieldChange(withRequired, 'photo', 'enabled', false);
    expect(updated.postFields?.photo.enabled).toBe(false);
    expect(updated.postFields?.photo.required).toBe(false);
  });
});

describe('allPostFieldsDisabled', () => {
  it('returns true when every field is disabled', () => {
    const pf = mergePostFieldSettings(
      Object.fromEntries(
        Object.keys(DEFAULT_POST_FIELD_SETTINGS).map((k) => [k, { enabled: false, required: false }]),
      ) as Partial<typeof DEFAULT_POST_FIELD_SETTINGS>,
    );
    expect(allPostFieldsDisabled(pf)).toBe(true);
  });
});
