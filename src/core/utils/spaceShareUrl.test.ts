import { describe, expect, it } from 'vitest';
import {
  buildPaneShareUrl,
  buildShareUrlForPane,
  buildSpaceShareUrl,
  paneQrDownloadFilename,
} from './spaceShareUrl';

const base = {
  origin: 'https://example.com',
  spaceURL: 'my-space',
  activeSpaceId: 'space-1',
};

describe('buildSpaceShareUrl', () => {
  it('builds community path when communitySlug is set', () => {
    expect(
      buildSpaceShareUrl({ ...base, communitySlug: 'demo' }),
    ).toBe('https://example.com/c/demo/s/my-space');
  });

  it('builds legacy path without community', () => {
    expect(
      buildSpaceShareUrl({ ...base, communitySlug: null }),
    ).toBe('https://example.com/s/my-space');
  });

  it('falls back to ?space= when spaceURL is missing', () => {
    expect(
      buildSpaceShareUrl({
        ...base,
        communitySlug: 'demo',
        spaceURL: undefined,
      }),
    ).toBe('https://example.com?space=space-1');
  });

  it('does not include pane param', () => {
    const url = buildSpaceShareUrl({ ...base, communitySlug: 'demo' });
    expect(url).not.toContain('pane=');
  });
});

describe('buildPaneShareUrl', () => {
  it('appends ?pane= for community path', () => {
    expect(
      buildPaneShareUrl({ ...base, communitySlug: 'demo', paneSlug: 'ideas' }),
    ).toBe('https://example.com/c/demo/s/my-space?pane=ideas');
  });

  it('appends ?pane= for legacy path', () => {
    expect(
      buildPaneShareUrl({ ...base, communitySlug: null, paneSlug: 'ideas' }),
    ).toBe('https://example.com/s/my-space?pane=ideas');
  });

  it('returns null when spaceURL is missing', () => {
    expect(
      buildPaneShareUrl({
        ...base,
        communitySlug: 'demo',
        spaceURL: undefined,
        paneSlug: 'ideas',
      }),
    ).toBeNull();
  });
});

describe('buildShareUrlForPane', () => {
  it('uses space URL without pane for default pane', () => {
    expect(
      buildShareUrlForPane({
        ...base,
        communitySlug: 'demo',
        pane: { slug: 'main', isDefault: true },
      }),
    ).toBe('https://example.com/c/demo/s/my-space');
  });

  it('uses pane URL for additional pane', () => {
    expect(
      buildShareUrlForPane({
        ...base,
        communitySlug: 'demo',
        pane: { slug: 'ideas', isDefault: false },
      }),
    ).toBe('https://example.com/c/demo/s/my-space?pane=ideas');
  });
});

describe('paneQrDownloadFilename', () => {
  it('includes spaceURL and pane slug', () => {
    expect(paneQrDownloadFilename('my-space', 'space-1', 'ideas')).toBe(
      'qr-my-space-ideas.png',
    );
  });

  it('falls back to spaceId when spaceURL is missing', () => {
    expect(paneQrDownloadFilename(undefined, 'space-1', 'ideas')).toBe(
      'qr-space-1-ideas.png',
    );
  });
});
