import { describe, expect, it } from 'vitest';
import {
  getHossiiBubbleFullText,
  isCharCountTruncated,
  isHossiiTextTruncated,
  truncateBubbleDisplayText,
  truncateStarPreviewText,
} from './bubbleTextTruncation';
import type { Hossii } from '../types';

const base: Hossii = {
  id: 'h1',
  message: 'hello',
  spaceId: 's1',
  createdAt: new Date(),
  origin: 'manual',
  isPositionFixed: false,
  scale: 1,
  isHidden: false,
  likeCount: 0,
  postKind: 'bubble',
};

describe('truncateBubbleDisplayText', () => {
  it('appends ellipsis when over max length', () => {
    const long = 'a'.repeat(130);
    expect(truncateBubbleDisplayText(long)).toBe('a'.repeat(120) + '…');
  });
});

describe('isCharCountTruncated', () => {
  it('detects truncated display text', () => {
    expect(isCharCountTruncated('abcdef', 'abc…')).toBe(true);
    expect(isCharCountTruncated('abc', 'abc')).toBe(false);
  });
});

describe('truncateStarPreviewText', () => {
  it('truncates at preview limit', () => {
    const long = 'x'.repeat(80);
    expect(truncateStarPreviewText(long)).toHaveLength(61);
    expect(truncateStarPreviewText(long).endsWith('…')).toBe(true);
  });
});

describe('getHossiiBubbleFullText', () => {
  it('returns empty for laughter', () => {
    expect(getHossiiBubbleFullText({ ...base, autoType: 'laughter' })).toBe('');
  });
});

describe('isHossiiTextTruncated', () => {
  it('returns false for empty full text', () => {
    expect(isHossiiTextTruncated('', '', null)).toBe(false);
  });
});
