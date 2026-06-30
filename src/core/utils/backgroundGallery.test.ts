import { describe, expect, it } from 'vitest';
import { appendSavedBackgroundUrl } from '../../core/utils/backgroundGallery';
import { MAX_BACKGROUND_IMAGES } from '../../core/types/space';

describe('appendSavedBackgroundUrl', () => {
  it('appends a new url', () => {
    expect(appendSavedBackgroundUrl(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('does not duplicate existing url', () => {
    expect(appendSavedBackgroundUrl(['a', 'b'], 'b')).toEqual(['a', 'b']);
  });

  it('respects max count', () => {
    const full = ['a', 'b', 'c'];
    expect(appendSavedBackgroundUrl(full, 'd', MAX_BACKGROUND_IMAGES)).toEqual(full);
  });

  it('handles undefined initial list', () => {
    expect(appendSavedBackgroundUrl(undefined, 'a')).toEqual(['a']);
  });
});
