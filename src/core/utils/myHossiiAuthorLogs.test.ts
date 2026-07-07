import { describe, expect, it } from 'vitest';
import {
  createEmptyAuthorGroup,
  resolveAuthorGroupForMyHossiiUser,
} from './myHossiiAuthorLogs';
import type { Hossii } from '../types';

function makeHossii(partial: Partial<Hossii> & Pick<Hossii, 'id' | 'createdAt'>): Hossii {
  return {
    message: 'test',
    spaceId: 'space-1',
    ...partial,
  } as Hossii;
}

describe('resolveAuthorGroupForMyHossiiUser', () => {
  const params = {
    userId: 'auth-uid-1',
    nickname: 'しづる',
    spaceId: 'space-1',
  };

  it('matches posts by auth uid', () => {
    const hossiis = [
      makeHossii({
        id: 'p1',
        authorId: 'auth-uid-1',
        authorName: 'しづる',
        createdAt: new Date('2026-07-01'),
      }),
    ];
    const group = resolveAuthorGroupForMyHossiiUser(hossiis, params);
    expect(group.posts).toHaveLength(1);
    expect(group.authorId).toBe('auth-uid-1');
  });

  it('falls back to nickname when authorId is legacy profile id', () => {
    const hossiis = [
      makeHossii({
        id: 'p1',
        authorId: 'legacy-profile-id',
        authorName: 'しづる',
        createdAt: new Date('2026-07-01'),
      }),
    ];
    const group = resolveAuthorGroupForMyHossiiUser(hossiis, params);
    expect(group.posts).toHaveLength(1);
    expect(group.authorName).toBe('しづる');
  });

  it('returns empty group when no posts match', () => {
    const group = resolveAuthorGroupForMyHossiiUser([], params);
    expect(group.posts).toHaveLength(0);
    expect(group.authorId).toBe('auth-uid-1');
    expect(group.authorName).toBe('しづる');
  });

  it('does not include posts from another space', () => {
    const hossiis = [
      makeHossii({
        id: 'p1',
        spaceId: 'space-2',
        authorId: 'auth-uid-1',
        authorName: 'しづる',
        createdAt: new Date('2026-07-01'),
      }),
    ];
    const group = resolveAuthorGroupForMyHossiiUser(hossiis, params);
    expect(group.posts).toHaveLength(0);
  });

  it('excludes hidden posts', () => {
    const hossiis = [
      makeHossii({
        id: 'p1',
        authorId: 'auth-uid-1',
        authorName: 'しづる',
        isHidden: true,
        createdAt: new Date('2026-07-01'),
      }),
    ];
    const group = resolveAuthorGroupForMyHossiiUser(hossiis, params);
    expect(group.posts).toHaveLength(0);
  });
});

describe('createEmptyAuthorGroup', () => {
  it('creates stable empty group for modal rendering', () => {
    const group = createEmptyAuthorGroup({
      userId: 'user-1',
      nickname: 'テスト',
      spaceId: 'space-1',
    });
    expect(group.posts).toEqual([]);
    expect(group.authorName).toBe('テスト');
    expect(group.latestPost.spaceId).toBe('space-1');
  });
});
