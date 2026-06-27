import { describe, expect, it } from 'vitest';
import type { SpacePane } from '../types/spacePane';
import {
  buildPaneSettingsPatch,
  hasPanePostFieldsOverride,
  mergePaneSettingsOverride,
} from './paneOverrideFields';

const basePane: SpacePane = {
  id: 'pane-2',
  spaceId: 'space-1',
  name: 'Ideas',
  slug: 'ideas',
  sortOrder: 1,
  isDefault: false,
  isVisible: true,
  settings: { posting: { positionMode: 'selector' } },
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('paneOverrideFields', () => {
  it('mergePaneSettingsOverride clears settings when all overrides null', () => {
    expect(
      mergePaneSettingsOverride(
        { postFields: { message: { enabled: false, required: false } } },
        { postFields: null },
      ),
    ).toBeNull();
  });

  it('buildPaneSettingsPatch resets position mode', () => {
    const patch = buildPaneSettingsPatch(basePane, 'positionMode', null);
    expect(patch.settings).toBeNull();
  });

  it('hasPanePostFieldsOverride detects override', () => {
    expect(
      hasPanePostFieldsOverride({
        ...basePane,
        settings: { postFields: { message: { enabled: false, required: false } } },
      }),
    ).toBe(true);
  });
});
