// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  applyConnectionTwoHopStars,
  clearConnectionTwoHopStars,
  CONNECTION_TWO_HOP_STARS_ATTR,
} from './connectionTwoHopStars';

describe('connectionTwoHopStars', () => {
  it('applies and clears star count attribute', () => {
    const element = document.createElement('div');
    applyConnectionTwoHopStars(element, 2);
    expect(element.getAttribute(CONNECTION_TWO_HOP_STARS_ATTR)).toBe('2');
    clearConnectionTwoHopStars(element);
    expect(element.hasAttribute(CONNECTION_TWO_HOP_STARS_ATTR)).toBe(false);
  });

  it('uses one star under reduced motion', () => {
    const element = document.createElement('div');
    applyConnectionTwoHopStars(element, 3, true);
    expect(element.getAttribute(CONNECTION_TWO_HOP_STARS_ATTR)).toBe('1');
  });
});
