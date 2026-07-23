import { describe, expect, it } from 'vitest';
import type { HossiiConnection } from '../types/hossiiConnection';
import {
  buildConnectionBadgeCounts,
  buildDirectConnectionListItems,
  countDirectConnections,
  buildDirectPeerTwoHopStarCounts,
  countVisibleTwoHopPeers,
  countVisibleTwoHopPeersForDirectPeer,
  filterVisibleConnections,
  getDirectPeerHossiiIds,
  shouldShowConnectionOverlay,
} from './connectionVisibility';

const connectionMeta = {
  createdBy: null,
  createdAt: '2026-07-22T00:00:00Z',
  updatedAt: '2026-07-22T00:00:00Z',
};

const baseGate = {
  presentationMode: 'custom' as const,
  renderAsStar: false,
  viewMode: 'full' as const,
  layoutMode: 'random' as const,
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

function makeConnection(
  overrides: Partial<HossiiConnection> = {},
): HossiiConnection {
  return {
    id: 'conn-1',
    spaceId: 'space-1',
    paneId: 'pane-1',
    sourceHossiiId: 'a',
    targetHossiiId: 'b',
    strength: 'medium',
    createdBy: null,
    createdAt: '2026-07-22T00:00:00.000Z',
    updatedAt: '2026-07-22T00:00:00.000Z',
    ...overrides,
  };
}

describe('shouldShowConnectionOverlay', () => {
  it('shows only in custom mode on desktop bubble with selection', () => {
    expect(
      shouldShowConnectionOverlay({
        ...baseGate,
        selectedBubbleId: 'h1',
      }),
    ).toBe(true);
  });

  it('hides in slideshow', () => {
    expect(
      shouldShowConnectionOverlay({
        ...baseGate,
        viewMode: 'slideshow',
        selectedBubbleId: 'h1',
      }),
    ).toBe(false);
  });

  it('hides when renderAsStar is true (mobile landscape)', () => {
    expect(
      shouldShowConnectionOverlay({
        ...baseGate,
        renderAsStar: true,
        selectedBubbleId: 'h1',
      }),
    ).toBe(false);
  });

  it('hides in star presentation mode', () => {
    expect(
      shouldShowConnectionOverlay({
        ...baseGate,
        presentationMode: 'stars',
        selectedBubbleId: 'h1',
      }),
    ).toBe(false);
  });

  it('hides in byAuthor layout', () => {
    expect(
      shouldShowConnectionOverlay({
        ...baseGate,
        layoutMode: 'byAuthor',
        selectedBubbleId: 'h1',
      }),
    ).toBe(false);
  });

  it('hides when nothing is selected', () => {
    expect(
      shouldShowConnectionOverlay({
        ...baseGate,
        layoutMode: 'ordered',
        selectedBubbleId: null,
      }),
    ).toBe(false);
  });

  it('allows overlay in archived spaces (view-only; mutation is out of scope here)', () => {
    expect(
      shouldShowConnectionOverlay({
        ...baseGate,
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

describe('buildDirectConnectionListItems', () => {
  it('returns peer ids for 1-hop connections regardless of direction', () => {
    const items = buildDirectConnectionListItems({
      connections: baseConnections,
      selectedBubbleId: 'h2',
      activePaneId: 'pane-a',
      visibleHossiiIds: new Set(['h1', 'h2', 'h3']),
    });

    expect(items.map((item) => item.peerHossiiId).sort()).toEqual(['h1', 'h3']);
    expect(items.find((item) => item.peerHossiiId === 'h1')?.strength).toBe('soft');
  });
});

describe('buildConnectionBadgeCounts', () => {
  it('counts direct connections for visible hossiis in active pane only', () => {
    const counts = buildConnectionBadgeCounts(
      [
        makeConnection({ id: '1', sourceHossiiId: 'a', targetHossiiId: 'b' }),
        makeConnection({
          id: '2',
          paneId: 'pane-2',
          sourceHossiiId: 'a',
          targetHossiiId: 'c',
        }),
        makeConnection({ id: '3', sourceHossiiId: 'b', targetHossiiId: 'c' }),
      ],
      'pane-1',
      new Set(['a', 'b', 'c']),
    );

    expect(counts.get('a')).toBe(1);
    expect(counts.get('b')).toBe(2);
    expect(counts.get('c')).toBe(1);
  });
});

describe('getDirectPeerHossiiIds / countVisibleTwoHopPeers', () => {
  it('lists direct peers and counts 2-hop visible nodes', () => {
    const visible = new Set(['h1', 'h2', 'h3']);
    const filter = {
      connections: baseConnections,
      selectedBubbleId: 'h1',
      activePaneId: 'pane-a',
      visibleHossiiIds: visible,
    };

    expect(getDirectPeerHossiiIds(filter)).toEqual(['h2']);
    expect(countVisibleTwoHopPeers(filter)).toBe(1);
  });

  it('returns zero 2-hop when no direct connections', () => {
    expect(
      countVisibleTwoHopPeers({
        connections: baseConnections,
        selectedBubbleId: 'h9',
        activePaneId: 'pane-a',
        visibleHossiiIds: new Set(['h1', 'h2', 'h3']),
      }),
    ).toBe(0);
  });
});


describe('buildDirectPeerTwoHopStarCounts', () => {
  const filter = {
    connections: [
      ...baseConnections,
      {
        id: 'c4',
        spaceId: 's1',
        paneId: 'pane-a',
        sourceHossiiId: 'h2',
        targetHossiiId: 'h4',
        strength: 'soft',
        ...connectionMeta,
      },
      {
        id: 'c5',
        spaceId: 's1',
        paneId: 'pane-a',
        sourceHossiiId: 'h2',
        targetHossiiId: 'h5',
        strength: 'soft',
        ...connectionMeta,
      },
      {
        id: 'c6',
        spaceId: 's1',
        paneId: 'pane-a',
        sourceHossiiId: 'h2',
        targetHossiiId: 'h6',
        strength: 'soft',
        ...connectionMeta,
      },
      {
        id: 'c7',
        spaceId: 's1',
        paneId: 'pane-a',
        sourceHossiiId: 'h2',
        targetHossiiId: 'h7',
        strength: 'soft',
        ...connectionMeta,
      },
    ],
    selectedBubbleId: 'h1',
    activePaneId: 'pane-a',
    visibleHossiiIds: new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7']),
  };

  it('returns peer-specific counts and excludes selected/direct peers', () => {
    expect(countVisibleTwoHopPeersForDirectPeer(filter, 'h2')).toBe(5);
    expect(buildDirectPeerTwoHopStarCounts(filter, ['h2']).get('h2')).toBe(3);
    expect(buildDirectPeerTwoHopStarCounts(filter, ['h3']).get('h3')).toBeUndefined();
  });

  it('excludes hidden and cross-pane 2-hop nodes', () => {
    const hiddenFilter = {
      ...filter,
      visibleHossiiIds: new Set(['h1', 'h2', 'h3']),
    };
    expect(countVisibleTwoHopPeersForDirectPeer(hiddenFilter, 'h2')).toBe(1);
    expect(buildDirectPeerTwoHopStarCounts(hiddenFilter, ['h2', 'h3']).get('h2')).toBe(1);
    expect(buildDirectPeerTwoHopStarCounts(hiddenFilter, ['h2', 'h3']).get('h3')).toBeUndefined();
  });
});
