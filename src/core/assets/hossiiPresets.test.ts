import { describe, expect, it } from 'vitest';
import {
  HOSSII_BASIC_PRESETS,
  getHossiiPresetByKey,
  isValidHossiiPresetKey,
  resolveHossiiPresetImagePath,
} from './hossiiPresets';

describe('hossiiPresets', () => {
  it('defines unique keys for basic presets', () => {
    const keys = HOSSII_BASIC_PRESETS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('uses idle images only', () => {
    for (const preset of HOSSII_BASIC_PRESETS) {
      expect(preset.imagePath).toMatch(/^\/hossii\/idle\//);
      expect(preset.key).toBeTruthy();
      expect(preset.label).toBeTruthy();
    }
  });

  it('validates known preset keys', () => {
    expect(isValidHossiiPresetKey('idle_base')).toBe(true);
    expect(isValidHossiiPresetKey('unknown')).toBe(false);
  });

  it('resolves image path from key', () => {
    expect(resolveHossiiPresetImagePath('idle_smile')).toBe('/hossii/idle/idle_smile.png');
    expect(resolveHossiiPresetImagePath('missing')).toBeNull();
  });

  it('returns preset by key', () => {
    expect(getHossiiPresetByKey('idle_closingeye')?.label).toContain('まばたき');
  });
});
