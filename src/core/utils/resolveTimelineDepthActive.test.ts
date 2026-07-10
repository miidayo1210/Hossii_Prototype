import { describe, expect, it } from 'vitest';
import { resolveTimelineDepthActive } from './resolveTimelineDepthActive';

describe('resolveTimelineDepthActive', () => {
  it('returns true when all conditions are true', () => {
    expect(
      resolveTimelineDepthActive({ enabled: true, isMainPane: true, isStarMode: true }),
    ).toBe(true);
  });

  it('returns false when enabled is false', () => {
    expect(
      resolveTimelineDepthActive({ enabled: false, isMainPane: true, isStarMode: true }),
    ).toBe(false);
  });

  it('returns false when not on main pane', () => {
    expect(
      resolveTimelineDepthActive({ enabled: true, isMainPane: false, isStarMode: true }),
    ).toBe(false);
  });

  it('returns false when not in star mode', () => {
    expect(
      resolveTimelineDepthActive({ enabled: true, isMainPane: true, isStarMode: false }),
    ).toBe(false);
  });

  it('returns false when multiple conditions are false', () => {
    expect(
      resolveTimelineDepthActive({ enabled: false, isMainPane: false, isStarMode: false }),
    ).toBe(false);
  });
});
