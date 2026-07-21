import { describe, expect, it } from 'vitest';
import {
  STAR_PREVIEW_X_THRESHOLD,
  STAR_PREVIEW_Y_THRESHOLD,
  resolveStarPreviewHorizontal,
  resolveStarPreviewVertical,
} from './starPreviewPlacement';

describe('resolveStarPreviewHorizontal', () => {
  it('places bubble left when star is on the right', () => {
    expect(resolveStarPreviewHorizontal(STAR_PREVIEW_X_THRESHOLD + 1)).toBe('left');
    expect(resolveStarPreviewHorizontal(92)).toBe('left');
  });

  it('places bubble right when star is on the left', () => {
    expect(resolveStarPreviewHorizontal(STAR_PREVIEW_X_THRESHOLD)).toBe('right');
    expect(resolveStarPreviewHorizontal(8)).toBe('right');
  });
});

describe('resolveStarPreviewVertical', () => {
  it('places bubble below when star is in the upper area', () => {
    expect(resolveStarPreviewVertical(STAR_PREVIEW_Y_THRESHOLD - 1)).toBe('below');
    expect(resolveStarPreviewVertical(8)).toBe('below');
  });

  it('places bubble above when star is in the lower area', () => {
    expect(resolveStarPreviewVertical(STAR_PREVIEW_Y_THRESHOLD)).toBe('above');
    expect(resolveStarPreviewVertical(92)).toBe('above');
  });
});
