import { describe, it, expect } from 'vitest';
import {
  BUBBLE_DRAG_THRESHOLD_PX,
  exceedsBubbleDragThreshold,
} from './bubbleDragThreshold';

describe('bubbleDragThreshold', () => {
  it('uses 5px as the default threshold', () => {
    expect(BUBBLE_DRAG_THRESHOLD_PX).toBe(5);
  });

  it('treats movement below 5px as a click', () => {
    expect(exceedsBubbleDragThreshold(4, 0)).toBe(false);
    expect(exceedsBubbleDragThreshold(3, 3)).toBe(false);
  });

  it('treats movement at or above 5px as a drag', () => {
    expect(exceedsBubbleDragThreshold(5, 0)).toBe(true);
    expect(exceedsBubbleDragThreshold(4, 3)).toBe(true);
  });
});
