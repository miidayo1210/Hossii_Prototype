import { describe, expect, it } from 'vitest';
import { previewOptimisticLikeState } from './likeMutationUi';

describe('previewOptimisticLikeState', () => {
  it('guest increments count and marks liked', () => {
    expect(
      previewOptimisticLikeState({ isLoggedIn: false, wasLiked: false, baseCount: 2 }),
    ).toEqual({ liked: true, count: 3 });
  });

  it('logged-in toggles 0 → 1', () => {
    expect(
      previewOptimisticLikeState({ isLoggedIn: true, wasLiked: false, baseCount: 0 }),
    ).toEqual({ liked: true, count: 1 });
  });

  it('logged-in toggles 1 → 0', () => {
    expect(
      previewOptimisticLikeState({ isLoggedIn: true, wasLiked: true, baseCount: 1 }),
    ).toEqual({ liked: false, count: 0 });
  });

  it('clamps negative base counts to 0 before applying delta', () => {
    expect(
      previewOptimisticLikeState({ isLoggedIn: true, wasLiked: true, baseCount: -3 }),
    ).toEqual({ liked: false, count: 0 });
  });
});
