import { describe, expect, it } from 'vitest';
import { deriveMyHossiiActivity, findAuthorGroupForUser } from './myHossiiActivity';
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

  it('aggregates posts across panes in the same space', () => {
    const userId = 'user-a';
    const paneOnly: Hossii[] = [];
    const allPanes = [
      makeHossii({
        id: 'pane-main',
        authorId: userId,
        spacePaneId: 'pane-main',
        createdAt: new Date('2026-07-01'),
        message: 'main',
      }),
      makeHossii({
        id: 'pane-sub',
        authorId: userId,
        spacePaneId: 'pane-sub',
        createdAt: new Date('2026-07-05'),
        message: 'sub',
      }),
    ];

    const paneActivity = deriveMyHossiiActivity(paneOnly, userId, {
      nickname: 'みい',
      spaceId: 'space-1',
    });
    const allPaneActivity = deriveMyHossiiActivity(allPanes, userId, {
      nickname: 'みい',
      spaceId: 'space-1',
    });

    expect(paneActivity.recentPosts).toHaveLength(0);
    expect(allPaneActivity.recentPosts).toHaveLength(2);
    expect(allPaneActivity.recentPosts[0]?.id).toBe('pane-sub');
  });
});

describe('findAuthorGroupForUser', () => {
  it('always returns a group when spaceId is provided', () => {
    const group = findAuthorGroupForUser([], 'auth-uid-1', 'しづる', 'space-1');
    expect(group).not.toBeNull();
    expect(group?.posts).toHaveLength(0);
    expect(group?.authorId).toBe('auth-uid-1');
  });

  it('resolves legacy nickname posts when auth uid does not match', () => {
    const hossiis = [
      makeHossii({
        id: 'p1',
        authorId: 'legacy-profile-id',
        authorName: 'しづる',
        createdAt: new Date('2026-07-01'),
      }),
    ];
    const group = findAuthorGroupForUser(hossiis, 'auth-uid-1', 'しづる', 'space-1');
    expect(group?.posts).toHaveLength(1);
  });
});

describe('findAuthorGroupForUser', () => {
  it('always returns a group when spaceId is provided', () => {
    const group = findAuthorGroupForUser([], 'auth-uid-1', 'しづる', 'space-1');
    expect(group).not.toBeNull();
    expect(group?.posts).toHaveLength(0);
    expect(group?.authorId).toBe('auth-uid-1');
  });

  it('resolves legacy nickname posts when auth uid does not match', () => {
    const hossiis = [
      makeHossii({
        id: 'p1',
        authorId: 'legacy-profile-id',
        authorName: 'しづる',
        createdAt: new Date('2026-07-01'),
      }),
    ];
    const group = findAuthorGroupForUser(hossiis, 'auth-uid-1', 'しづる', 'space-1');
    expect(group?.posts).toHaveLength(1);
  });
});
