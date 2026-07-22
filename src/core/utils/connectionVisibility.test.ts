import { describe, expect, it } from 'vitest';
import type { HossiiConnection } from '../types/hossiiConnection';
import {
  countDirectConnections,
  filterVisibleConnections,
  shouldShowConnectionOverlay,
} from './connectionVisibility';

const connectionMeta = {
  createdBy: null,
  createdAt: '2026-07-22T00:00:00Z',
  updatedAt: '2026-07-22T00:00:00Z',
};

const baseConnections: HossiiConnection[] = [
  {
    id: 'c1',
    spaceId: 's1',
    paneId: 'pane-a',
    sourceHossiiId: 'h1',
    targetHossiiId: 'h2',
    strength: 'soft',
    ...connectionMeta,
  },
  {
    id: 'c2',
    spaceId: 's1',
    paneId: 'pane-a',
    sourceHossiiId: 'h2',
    targetHossiiId: 'h3',
    strength: 'medium',
    ...connectionMeta,
  },
  {
    id: 'c3',
    spaceId: 's1',
    paneId: 'pane-b',
    sourceHossiiId: 'h1',
    targetHossiiId: 'h2',
    strength: 'strong',
    ...connectionMeta,
  },
];

describe('shouldShowConnectionOverlay', () => {
  it('shows only in custom mode on desktop with selection', () => {
    expect(
      shouldShowConnectionOverlay({
        presentationMode: 'custom',
        isMobile: false,
        layoutMode: 'random',
        selectedBubbleId: 'h1',
      }),
    ).toBe(true);
  });

  it('hides in star mode', () => {
    expect(
      shouldShowConnectionOverlay({
        presentationMode: 'stars',
        isMobile: false,
        layoutMode: 'random',
        selectedBubbleId: 'h1',
      }),
    ).toBe(false);
  });

  it('hides on mobile', () => {
    expect(
      shouldShowConnectionOverlay({
        presentationMode: 'custom',
        isMobile: true,
        layoutMode: 'random',
        selectedBubbleId: 'h1',
      }),
    ).toBe(false);
  });

  it('hides in byAuthor layout', () => {
    expect(
      shouldShowConnectionOverlay({
        presentationMode: 'custom',
        isMobile: false,
        layoutMode: 'byAuthor',
        selectedBubbleId: 'h1',
      }),
    ).toBe(false);
  });

  it('hides when nothing is selected', () => {
    expect(
      shouldShowConnectionOverlay({
        presentationMode: 'custom',
        isMobile: false,
        layoutMode: 'ordered',
        selectedBubbleId: null,
      }),
    ).toBe(false);
  });

  it('allows overlay in archived spaces (view-only; mutation is out of scope here)', () => {
    expect(
      shouldShowConnectionOverlay({
        presentationMode: 'custom',
        isMobile: false,
        layoutMode: 'random',
        selectedBubbleId: 'h1',
      }),
    ).toBe(true);
  });
});

describe('filterVisibleConnections', () => {
  const visible = new Set(['h1', 'h2', 'h3']);

  it('returns only direct connections from selected root (1 hop)', () => {
    const result = filterVisibleConnections({
      connections: baseConnections,
      selectedBubbleId: 'h1',
      activePaneId: 'pane-a',
      visibleHossiiIds: visible,
    });
    expect(result.map((c) => c.id)).toEqual(['c1']);
  });

  it('hides unrelated connections (2 hops away)', () => {
    const result = filterVisibleConnections({
      connections: baseConnections,
      selectedBubbleId: 'h1',
      activePaneId: 'pane-a',
      visibleHossiiIds: visible,
    });
    expect(result.some((c) => c.id === 'c2')).toBe(false);
  });

  it('hides connections from other panes', () => {
    const result = filterVisibleConnections({
      connections: baseConnections,
      selectedBubbleId: 'h1',
      activePaneId: 'pane-a',
      visibleHossiiIds: visible,
    });
    expect(result.some((c) => c.id === 'c3')).toBe(false);
  });

  it('hides when endpoint hossii is not visible', () => {
    const result = filterVisibleConnections({
      connections: baseConnections,
      selectedBubbleId: 'h2',
      activePaneId: 'pane-a',
      visibleHossiiIds: new Set(['h2']),
    });
    expect(result).toHaveLength(0);
  });
});

describe('countDirectConnections', () => {
  const visible = new Set(['h1', 'h2', 'h3']);

  it('matches filterVisibleConnections length', () => {
    const filter = {
      connections: baseConnections,
      selectedBubbleId: 'h2',
      activePaneId: 'pane-a',
      visibleHossiiIds: visible,
    };
    expect(countDirectConnections(filter)).toBe(filterVisibleConnections(filter).length);
    expect(countDirectConnections(filter)).toBe(2);
  });
});
