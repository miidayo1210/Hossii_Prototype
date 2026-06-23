import { describe, expect, it } from 'vitest';
import {
  createBubblePosition,
  createBubblePositionInSharp,
  createOrderedBubblePosition,
} from './bubblePosition';

describe('createBubblePosition', () => {
  it('keeps x/y within 8–92% for indices 0–99', () => {
    for (let i = 0; i < 100; i++) {
      const { x, y } = createBubblePosition(i);
      expect(x).toBeGreaterThanOrEqual(8);
      expect(x).toBeLessThanOrEqual(92);
      expect(y).toBeGreaterThanOrEqual(8);
      expect(y).toBeLessThanOrEqual(92);
    }
  });

  it('is deterministic for the same index', () => {
    expect(createBubblePosition(7)).toEqual(createBubblePosition(7));
  });

  it('does not cluster heavily in the central 40–60% band', () => {
    let central = 0;
    for (let i = 0; i < 1000; i++) {
      const { x, y } = createBubblePosition(i);
      if (x >= 40 && x <= 60 && y >= 40 && y <= 60) central++;
    }
    expect(central / 1000).toBeLessThan(0.4);
  });
});

describe('createBubblePositionInSharp', () => {
  it('keeps x/y within 5–95% for indices 0–99', () => {
    for (let i = 0; i < 100; i++) {
      const { x, y } = createBubblePositionInSharp(i);
      expect(x).toBeGreaterThanOrEqual(5);
      expect(x).toBeLessThanOrEqual(95);
      expect(y).toBeGreaterThanOrEqual(5);
      expect(y).toBeLessThanOrEqual(95);
    }
  });

  it('is deterministic for the same index', () => {
    expect(createBubblePositionInSharp(12)).toEqual(createBubblePositionInSharp(12));
  });
});

describe('createOrderedBubblePosition', () => {
  it('preserves existing grid anchor for 9 posts', () => {
    expect(createOrderedBubblePosition(0, 9)).toEqual({ x: 8, y: 12 });
  });
});
