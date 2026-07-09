import { describe, expect, it } from 'vitest';
import { timelineDepthScaleFromIndex } from './timelineDepthScale';

describe('timelineDepthScaleFromIndex', () => {
  it.each([
    { index: -1, scale: 1.0 },
    { index: 0, scale: 1.0 },
    { index: 9, scale: 1.0 },
    { index: 10, scale: 0.94 },
    { index: 29, scale: 0.94 },
    { index: 30, scale: 0.88 },
    { index: 59, scale: 0.88 },
    { index: 60, scale: 0.82 },
    { index: 999, scale: 0.82 },
  ])('index $index → $scale', ({ index, scale }) => {
    expect(timelineDepthScaleFromIndex(index)).toBe(scale);
  });
});
