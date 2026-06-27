import { describe, expect, it } from 'vitest';
import type { Hossii } from '../types';
import {
  createEmptyEntitiesSlice,
  setOrderedIdsForQuery,
  upsertEntities,
} from './hossiiEntitiesState';
import { reconcileHossiiQueryKeys } from './reconcileHossiiQueryKeys';
import { buildQueryKeyV2 } from './hossiiQueryKey';

const spaceId = 'space-1';
const defaultPaneId = `${spaceId}-pane-default`;
const paneAId = `${spaceId}-pane-a`;
const paneBId = `${spaceId}-pane-b`;

function h(id: string, spacePaneId: string): Hossii {
  return {
    id,
    message: id,
    spaceId,
    spacePaneId,
    createdAt: new Date(),
  };
}

describe('reconcileHossiiQueryKeys', () => {
  const defaultKey = buildQueryKeyV2(spaceId, { kind: 'pane', paneId: defaultPaneId }, '1w');
  const paneAKey = buildQueryKeyV2(spaceId, { kind: 'pane', paneId: paneAId }, '1w');
  const paneBKey = buildQueryKeyV2(spaceId, { kind: 'pane', paneId: paneBId }, '1w');
  const allKey = buildQueryKeyV2(spaceId, { kind: 'all-panes' }, 'all');

  it('moves id from pane A key to pane B key when spacePaneId changes', () => {
    const original = h('post-1', paneAId);
    let slice = createEmptyEntitiesSlice();
    slice = upsertEntities(slice, [original]);
    slice = setOrderedIdsForQuery(slice, paneAKey, ['post-1']);
    slice = setOrderedIdsForQuery(slice, paneBKey, []);
    slice = setOrderedIdsForQuery(slice, allKey, ['post-1']);
    slice = setOrderedIdsForQuery(slice, defaultKey, []);

    const moved = { ...original, spacePaneId: paneBId };
    const next = reconcileHossiiQueryKeys(slice, moved);

    expect(next.orderedIdsByQueryKey[paneAKey]).toEqual([]);
    expect(next.orderedIdsByQueryKey[paneBKey]).toEqual(['post-1']);
    expect(next.orderedIdsByQueryKey[allKey]).toEqual(['post-1']);
    expect(next.orderedIdsByQueryKey[defaultKey]).toEqual([]);
  });

  it('adds id to default pane key when moved from pane A to default', () => {
    const original = h('post-2', paneAId);
    let slice = createEmptyEntitiesSlice();
    slice = upsertEntities(slice, [original]);
    slice = setOrderedIdsForQuery(slice, paneAKey, ['post-2']);
    slice = setOrderedIdsForQuery(slice, defaultKey, []);
    slice = setOrderedIdsForQuery(slice, allKey, ['post-2']);

    const moved = { ...original, spacePaneId: defaultPaneId };
    const next = reconcileHossiiQueryKeys(slice, moved);

    expect(next.orderedIdsByQueryKey[paneAKey]).toEqual([]);
    expect(next.orderedIdsByQueryKey[defaultKey]).toEqual(['post-2']);
    expect(next.orderedIdsByQueryKey[allKey]).toEqual(['post-2']);
  });
});
