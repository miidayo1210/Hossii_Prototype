import type { Hossii } from '../types';
import type { LayoutMode } from './displayPrefsStorage';
import {
  createAuthorRowPosition,
  createAuthorRowPositionInSharp,
  createBubblePositionFromId,
  createBubblePositionInSharpFromId,
  createOrderedBubblePosition,
  createOrderedBubblePositionInSharp,
} from './bubblePosition';

export type PositionCache = Record<string, { x: number; y: number }>;

export type ComputePositionsInput = {
  filteredHossiis: Hossii[];
  authorGroupCount: number;
  layoutMode: LayoutMode;
  shouldMapToSharp: boolean;
  orderedSortDirection: 'asc' | 'desc';
  cache: PositionCache;
};

export type ComputePositionsResult = {
  positionsByHossiiId: PositionCache;
  authorClusterPositions: { x: number; y: number }[];
};

/** filteredIds ベースで座標を算出し id キーでキャッシュ */
export function computeBubblePositions(input: ComputePositionsInput): ComputePositionsResult {
  const {
    filteredHossiis,
    authorGroupCount,
    layoutMode,
    shouldMapToSharp,
    orderedSortDirection,
    cache,
  } = input;

  const createRandom = shouldMapToSharp
    ? createBubblePositionInSharpFromId
    : createBubblePositionFromId;
  const createOrdered = shouldMapToSharp
    ? createOrderedBubblePositionInSharp
    : createOrderedBubblePosition;
  const createAuthorRow = shouldMapToSharp
    ? createAuthorRowPositionInSharp
    : createAuthorRowPosition;

  const nextCache: PositionCache = { ...cache };
  const n = filteredHossiis.length;

  if (layoutMode === 'byAuthor') {
    const authorClusterPositions = Array.from({ length: authorGroupCount }, (_, i) =>
      createAuthorRow(i, authorGroupCount),
    );
    return { positionsByHossiiId: nextCache, authorClusterPositions };
  }

  if (layoutMode === 'ordered') {
    for (let index = 0; index < n; index += 1) {
      const hossii = filteredHossiis[index];
      const gridIndex =
        orderedSortDirection === 'asc' ? n - 1 - index : index;
      nextCache[hossii.id] = createOrdered(gridIndex, n);
    }
    return { positionsByHossiiId: nextCache, authorClusterPositions: [] };
  }

  for (let index = 0; index < n; index += 1) {
    const hossii = filteredHossiis[index];
    if (
      hossii.isPositionFixed &&
      hossii.positionX != null &&
      hossii.positionY != null
    ) {
      nextCache[hossii.id] = { x: hossii.positionX, y: hossii.positionY };
    } else if (!nextCache[hossii.id]) {
      nextCache[hossii.id] = createRandom(hossii.id);
    }
  }

  return { positionsByHossiiId: nextCache, authorClusterPositions: [] };
}
