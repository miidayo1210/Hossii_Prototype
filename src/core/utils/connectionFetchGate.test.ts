import { describe, expect, it } from 'vitest';
import { shouldFetchHossiiConnections } from './connectionFetchGate';

describe('shouldFetchHossiiConnections', () => {
  const base = {
    presentationMode: 'custom' as const,
    isMobile: false,
    layoutMode: 'random' as const,
    spaceId: 's1',
    paneId: 'p1',
  };

  it('fetches in PC custom random/ordered', () => {
    expect(shouldFetchHossiiConnections(base)).toBe(true);
    expect(shouldFetchHossiiConnections({ ...base, layoutMode: 'ordered' })).toBe(true);
  });

  it('does not fetch in star mode', () => {
    expect(
      shouldFetchHossiiConnections({ ...base, presentationMode: 'stars' }),
    ).toBe(false);
  });

  it('does not fetch on mobile', () => {
    expect(shouldFetchHossiiConnections({ ...base, isMobile: true })).toBe(false);
  });

  it('does not fetch in byAuthor layout', () => {
    expect(shouldFetchHossiiConnections({ ...base, layoutMode: 'byAuthor' })).toBe(false);
  });

  it('does not fetch without space or pane id', () => {
    expect(shouldFetchHossiiConnections({ ...base, spaceId: '' })).toBe(false);
    expect(shouldFetchHossiiConnections({ ...base, paneId: '' })).toBe(false);
  });
});
