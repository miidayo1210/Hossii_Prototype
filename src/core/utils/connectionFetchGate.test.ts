import { describe, expect, it } from 'vitest';
import {
  connectionsEnabled,
  isConnectionsContextEnabled,
  resolveRenderAsStar,
  shouldFetchHossiiConnections,
} from './connectionFetchGate';

describe('isConnectionsContextEnabled / connectionsEnabled', () => {
  const base = {
    presentationMode: 'custom' as const,
    renderAsStar: false,
    viewMode: 'full' as const,
    layoutMode: 'random' as const,
  };

  it('enables PC custom random / ordered', () => {
    expect(isConnectionsContextEnabled(base)).toBe(true);
    expect(connectionsEnabled({ ...base, layoutMode: 'ordered' })).toBe(true);
  });

  it('disables slideshow', () => {
    expect(isConnectionsContextEnabled({ ...base, viewMode: 'slideshow' })).toBe(false);
  });

  it('disables when renderAsStar is true (mobile portrait / star presentation)', () => {
    expect(
      isConnectionsContextEnabled({
        ...base,
        renderAsStar: true,
        presentationMode: 'custom',
      }),
    ).toBe(false);
  });

  it('disables star presentation mode', () => {
    expect(
      isConnectionsContextEnabled({ ...base, presentationMode: 'stars' }),
    ).toBe(false);
  });

  it('disables byAuthor layout', () => {
    expect(isConnectionsContextEnabled({ ...base, layoutMode: 'byAuthor' })).toBe(false);
  });
});

describe('resolveRenderAsStar', () => {
  it('uses Star on mobile portrait and PC star presentation only', () => {
    expect(
      resolveRenderAsStar({ isMobilePortrait: true, presentationMode: 'custom' }),
    ).toBe(true);
    expect(
      resolveRenderAsStar({ isMobilePortrait: false, presentationMode: 'stars' }),
    ).toBe(true);
    expect(
      resolveRenderAsStar({ isMobilePortrait: false, presentationMode: 'custom' }),
    ).toBe(false);
  });
});

describe('shouldFetchHossiiConnections', () => {
  const base = {
    presentationMode: 'custom' as const,
    renderAsStar: false,
    viewMode: 'full' as const,
    layoutMode: 'random' as const,
    spaceId: 's1',
    paneId: 'p1',
  };

  it('fetches in PC custom random/ordered', () => {
    expect(shouldFetchHossiiConnections(base)).toBe(true);
    expect(shouldFetchHossiiConnections({ ...base, layoutMode: 'ordered' })).toBe(true);
  });

  it('does not fetch in slideshow', () => {
    expect(shouldFetchHossiiConnections({ ...base, viewMode: 'slideshow' })).toBe(false);
  });

  it('does not fetch when renderAsStar is true even on wide viewport', () => {
    expect(shouldFetchHossiiConnections({ ...base, renderAsStar: true })).toBe(false);
  });

  it('does not fetch in star presentation mode', () => {
    expect(
      shouldFetchHossiiConnections({ ...base, presentationMode: 'stars' }),
    ).toBe(false);
  });

  it('does not fetch in byAuthor layout', () => {
    expect(shouldFetchHossiiConnections({ ...base, layoutMode: 'byAuthor' })).toBe(false);
  });

  it('does not fetch without space or pane id', () => {
    expect(shouldFetchHossiiConnections({ ...base, spaceId: '' })).toBe(false);
    expect(shouldFetchHossiiConnections({ ...base, paneId: '' })).toBe(false);
  });
});
