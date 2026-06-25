import { describe, expect, it } from 'vitest';
import { BUBBLE_SHAPE_PRESETS } from '../assets/bubbleShapes';

describe('BUBBLE_SHAPE_PRESETS', () => {
  it('contains 14 shape presets', () => {
    expect(BUBBLE_SHAPE_PRESETS).toHaveLength(14);
  });

  it('each preset has path and label', () => {
    for (const preset of BUBBLE_SHAPE_PRESETS) {
      expect(preset.path).toMatch(/^\/assets\/bubble-shapes\//);
      expect(preset.label.length).toBeGreaterThan(0);
    }
  });
});
