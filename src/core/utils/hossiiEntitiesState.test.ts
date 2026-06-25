import { describe, it, expect } from 'vitest';
import type { Hossii } from '../types';
import {
  applyFetchResult,
  createEmptyEntitiesSlice,
  patchEntity,
  upsertEntities,
} from './hossiiEntitiesState';

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
});
