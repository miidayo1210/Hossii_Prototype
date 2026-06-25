import { describe, expect, it } from 'vitest';
import { castToFeatureFlags, type FeatureFlags } from './featureFlagsApi';

const EXPECTED_KEYS: (keyof FeatureFlags)[] = [
  'public_board_mode',
  'zine_export_enabled',
  'bubble_shapes_extended',
];

describe('castToFeatureFlags', () => {
  it('returns exactly 3 internal keys', () => {
    const flags = castToFeatureFlags({});
    expect(Object.keys(flags).sort()).toEqual([...EXPECTED_KEYS].sort());
  });

  it('ignores deprecated migrated keys from raw input', () => {
    const flags = castToFeatureFlags({
      likes_enabled: true,
      comments_thumbnail: false,
      random_recall_enabled: true,
      position_selector: true,
      space_canvas_export_enabled: true,
      bubble_shapes_extended: true,
    });
    expect(flags).toEqual({
      public_board_mode: false,
      zine_export_enabled: false,
      bubble_shapes_extended: true,
    });
  });
});
