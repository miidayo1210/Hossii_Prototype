import { describe, it, expect } from 'vitest';
import type { Hossii } from '../types';
import { runDisplayPipeline } from './hossiiDisplayPipeline';

function makeHossii(id: string, overrides: Partial<Hossii> = {}): Hossii {
  return {
    id,
    message: id,
    spaceId: 's1',
    createdAt: new Date('2026-01-01T12:00:00Z'),
    isHidden: false,
    isPositionFixed: false,
    scale: 1,
    postKind: 'bubble',
    ...overrides,
  };
}

describe('runDisplayPipeline', () => {
  it('slices to displayLimit after sort', () => {
    const hossiis = [
      makeHossii('a', { createdAt: new Date('2026-01-03T12:00:00Z') }),
      makeHossii('b', { createdAt: new Date('2026-01-02T12:00:00Z') }),
      makeHossii('c', { createdAt: new Date('2026-01-01T12:00:00Z') }),
    ];
    const result = runDisplayPipeline({
      hossiis,
      displayPeriod: 'all',
      displayLimit: 2,
      viewMode: 'full',
      activeTagFilter: null,
    });
    expect(result.displayIds).toEqual(['a', 'b']);
  });

  it('filters by tag on display set only', () => {
    const hossiis = [
      makeHossii('a', { tags: ['fun'] }),
      makeHossii('b', { tags: ['work'] }),
    ];
    const result = runDisplayPipeline({
      hossiis,
      displayPeriod: 'all',
      displayLimit: 50,
      viewMode: 'full',
      activeTagFilter: 'fun',
    });
    expect(result.filteredIds).toEqual(['a']);
  });

  it('breaks ties by id DESC when createdAt is equal', () => {
    const same = new Date('2026-06-01T10:00:00.000Z');
    const hossiis = [
      makeHossii('id-a', { createdAt: same }),
      makeHossii('id-c', { createdAt: same }),
      makeHossii('id-b', { createdAt: same }),
    ];
    const result = runDisplayPipeline({
      hossiis,
      displayPeriod: 'all',
      displayLimit: 50,
      viewMode: 'full',
      activeTagFilter: null,
    });
    expect(result.displayIds).toEqual(['id-c', 'id-b', 'id-a']);
  });

  it('slices by displayLimit after id tie-break sort', () => {
    const same = new Date('2026-06-01T10:00:00.000Z');
    const hossiis = [
      makeHossii('id-0', { createdAt: same }),
      makeHossii('id-3', { createdAt: same }),
      makeHossii('id-1', { createdAt: same }),
      makeHossii('id-2', { createdAt: same }),
    ];
    const result = runDisplayPipeline({
      hossiis,
      displayPeriod: 'all',
      displayLimit: 2,
      viewMode: 'full',
      activeTagFilter: null,
    });
    expect(result.displayIds).toEqual(['id-3', 'id-2']);
  });

  it('excludes hidden and image-only filter', () => {
    const hossiis = [
      makeHossii('a', { isHidden: true }),
      makeHossii('b', { imageUrl: undefined }),
      makeHossii('c', { imageUrl: 'https://example.com/x.png' }),
    ];
    const result = runDisplayPipeline({
      hossiis,
      displayPeriod: 'all',
      displayLimit: 50,
      viewMode: 'image',
      activeTagFilter: null,
    });
    expect(result.displayIds).toEqual(['c']);
  });
});
