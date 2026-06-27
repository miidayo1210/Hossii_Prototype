import { describe, expect, it } from 'vitest';
import {
  buildUrlWithPaneSlug,
  readPaneSlugFromUrl,
} from './paneUrl';

describe('paneUrl', () => {
  describe('readPaneSlugFromUrl', () => {
    it('returns null when pane param is absent', () => {
      expect(readPaneSlugFromUrl('')).toBeNull();
      expect(readPaneSlugFromUrl('?foo=bar')).toBeNull();
    });

    it('returns slug when pane param is set', () => {
      expect(readPaneSlugFromUrl('?pane=ideas')).toBe('ideas');
      expect(readPaneSlugFromUrl('?pane=main&foo=bar')).toBe('main');
    });

    it('returns null for empty pane param', () => {
      expect(readPaneSlugFromUrl('?pane=')).toBeNull();
      expect(readPaneSlugFromUrl('?pane=%20')).toBeNull();
    });
  });

  describe('buildUrlWithPaneSlug', () => {
    const base = { pathname: '/c/demo/s/test', search: '', hash: '#screen' };

    it('adds pane param', () => {
      expect(buildUrlWithPaneSlug('ideas', base)).toBe(
        '/c/demo/s/test?pane=ideas#screen',
      );
    });

    it('removes pane param when slug is null', () => {
      expect(
        buildUrlWithPaneSlug(null, { ...base, search: '?pane=ideas&foo=1' }),
      ).toBe('/c/demo/s/test?foo=1#screen');
    });

    it('replaces existing pane param', () => {
      expect(
        buildUrlWithPaneSlug('summary', { ...base, search: '?pane=ideas' }),
      ).toBe('/c/demo/s/test?pane=summary#screen');
    });
  });
});
