import { describe, expect, it } from 'vitest';
import { computePreviewSlotCount } from './previewSlotCount';

const base = {
  layoutMode: 'random',
  useStarView: true,
  isMobile: false,
  isPortrait: true,
  presentationMode: 'stars' as const,
};

describe('computePreviewSlotCount', () => {
  it('returns 0 for byAuthor', () => {
    expect(
      computePreviewSlotCount({ ...base, layoutMode: 'byAuthor', postsWithContentCount: 10 }),
    ).toBe(0);
  });

  it('PC stars: caps at 6', () => {
    expect(computePreviewSlotCount({ ...base, postsWithContentCount: 10 })).toBe(6);
  });

  it('PC stars: returns post count when below cap', () => {
    expect(computePreviewSlotCount({ ...base, postsWithContentCount: 3 })).toBe(3);
  });

  it('mobile portrait: caps at 3 when more than 3 posts', () => {
    expect(
      computePreviewSlotCount({
        ...base,
        isMobile: true,
        postsWithContentCount: 5,
      }),
    ).toBe(3);
  });

  it('mobile portrait: single slot when 3 or fewer posts', () => {
    expect(
      computePreviewSlotCount({
        ...base,
        isMobile: true,
        postsWithContentCount: 2,
      }),
    ).toBe(1);
  });

  it('returns 0 when star view off', () => {
    expect(
      computePreviewSlotCount({ ...base, useStarView: false, postsWithContentCount: 10 }),
    ).toBe(0);
  });
});
