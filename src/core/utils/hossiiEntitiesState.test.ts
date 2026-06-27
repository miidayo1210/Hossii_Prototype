import { describe, it, expect } from 'vitest';
import type { Hossii } from '../types';
import {
  applyFetchResult,
  createEmptyEntitiesSlice,
  getHossiisForQueryKey,
  patchEntity,
  removeOrderedIdFromQueryKey,
  shouldReindexOrderedIds,
  upsertEntities,
} from './hossiiEntitiesState';
import { buildQueryKeyV2 } from './hossiiQueryKey';

function h(id: string, createdAt: string): Hossii {
  return {
    id,
    message: id,
    spaceId: 'space-1',
    createdAt: new Date(createdAt),
    isHidden: false,
    isPositionFixed: false,
    scale: 1,
    postKind: 'bubble',
  };
}

describe('hossiiEntitiesState', () => {
  it('applyFetchResult replaces ordered ids for queryKey', () => {
    const slice = createEmptyEntitiesSlice();
    const next = applyFetchResult(slice, 'space-1:1w:v1', [h('a', '2026-01-02'), h('b', '2026-01-01')], false);
    expect(next.orderedIdsByQueryKey['space-1:1w:v1']).toEqual(['a', 'b']);
    expect(next.entitiesById.a?.id).toBe('a');
  });

  it('patchEntity creates new object reference only for patched id', () => {
    const base = upsertEntities(createEmptyEntitiesSlice(), [h('a', '2026-01-01')]);
    const before = base.entitiesById.a;
    const next = patchEntity(base, { ...before!, likeCount: 3 });
    expect(next.entitiesById.a).not.toBe(before);
    expect(next.entitiesById.a?.likeCount).toBe(3);
  });

  it('keeps orderedIds separate per pane query key while sharing entities', () => {
    const spaceId = 'space-1';
    const defaultPaneId = `${spaceId}-pane-default`;
    const paneAId = `${spaceId}-pane-a`;
    const keyDefault = buildQueryKeyV2(spaceId, { kind: 'pane', paneId: defaultPaneId }, '1w');
    const keyPaneA = buildQueryKeyV2(spaceId, { kind: 'pane', paneId: paneAId }, '1w');

    const nullPost = { ...h('null-post', '2026-01-03'), spacePaneId: undefined };
    const paneAPost = { ...h('pane-a-post', '2026-01-02'), spacePaneId: paneAId };

    let slice = createEmptyEntitiesSlice();
    slice = applyFetchResult(slice, keyDefault, [nullPost], false);
    slice = applyFetchResult(slice, keyPaneA, [paneAPost], false);

    expect(getHossiisForQueryKey(slice, keyDefault).map((x) => x.id)).toEqual(['null-post']);
    expect(getHossiisForQueryKey(slice, keyPaneA).map((x) => x.id)).toEqual(['pane-a-post']);
    expect(slice.entitiesById['null-post']).toBeDefined();
    expect(slice.entitiesById['pane-a-post']).toBeDefined();
  });

  it('removeOrderedIdFromQueryKey drops id from one key only', () => {
    const spaceId = 'space-1';
    const defaultPaneId = `${spaceId}-pane-default`;
    const keyDefault = buildQueryKeyV2(spaceId, { kind: 'pane', paneId: defaultPaneId }, '1w');
    const post = h('x', '2026-01-01');
    let slice = applyFetchResult(createEmptyEntitiesSlice(), keyDefault, [post], false);
    slice = removeOrderedIdFromQueryKey(slice, keyDefault, 'x');
    expect(getHossiisForQueryKey(slice, keyDefault)).toEqual([]);
    expect(slice.entitiesById.x).toBeDefined();
  });

  it('shouldReindexOrderedIds when spacePaneId changes', () => {
    const base = h('a', '2026-01-01');
    expect(shouldReindexOrderedIds(base, { ...base, spacePaneId: 'pane-b' })).toBe(true);
    expect(shouldReindexOrderedIds(base, { ...base, likeCount: 1 })).toBe(false);
  });
});
