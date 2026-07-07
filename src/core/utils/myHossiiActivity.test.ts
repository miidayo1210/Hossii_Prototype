import { describe, expect, it } from 'vitest';
import { deriveMyHossiiActivity } from './myHossiiActivity';
import type { Hossii } from '../types';

function makeHossii(partial: Partial<Hossii> & Pick<Hossii, 'id' | 'createdAt'>): Hossii {
  return {
    message: 'test',
    spaceId: 'space-1',
    ...partial,
  } as Hossii;
}

describe('deriveMyHossiiActivity', () => {
  it('returns recent 3 posts for target user', () => {
    const userId = 'user-a';
    const hossiis = [
      makeHossii({ id: '1', authorId: userId, createdAt: new Date('2026-07-01'), message: '1' }),
      makeHossii({ id: '2', authorId: userId, createdAt: new Date('2026-07-02'), message: '2' }),
      makeHossii({ id: '3', authorId: userId, createdAt: new Date('2026-07-03'), message: '3' }),
      makeHossii({ id: '4', authorId: userId, createdAt: new Date('2026-07-04'), message: '4' }),
      makeHossii({ id: '5', authorId: 'other', createdAt: new Date('2026-07-05'), message: 'x' }),
    ];

    const activity = deriveMyHossiiActivity(hossiis, userId);
    expect(activity.recentPosts).toHaveLength(3);
    expect(activity.recentPosts[0]?.id).toBe('4');
    expect(activity.recentPosts[2]?.id).toBe('2');
  });

  it('excludes hidden posts', () => {
    const userId = 'user-a';
    const hossiis = [
      makeHossii({ id: '1', authorId: userId, createdAt: new Date('2026-07-04'), isHidden: true }),
      makeHossii({ id: '2', authorId: userId, createdAt: new Date('2026-07-03'), message: 'ok' }),
    ];
    const activity = deriveMyHossiiActivity(hossiis, userId);
    expect(activity.recentPosts).toHaveLength(1);
    expect(activity.recentPosts[0]?.id).toBe('2');
  });
});
