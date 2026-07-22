import { describe, expect, it } from 'vitest';
import type { Hossii } from '../../core/types';

function patchVisitingHossiiLikeCount(
  prev: Hossii[],
  id: string,
  likeCount: number,
): Hossii[] {
  return prev.map((h) => (h.id === id ? { ...h, likeCount } : h));
}

describe('patchVisitingHossiiLikeCount', () => {
  it('updates only the matching hossii likeCount', () => {
    const prev = [
      { id: 'a', likeCount: 1 } as Hossii,
      { id: 'b', likeCount: 2 } as Hossii,
    ];
    const next = patchVisitingHossiiLikeCount(prev, 'b', 5);
    expect(next[0].likeCount).toBe(1);
    expect(next[1].likeCount).toBe(5);
  });
});
