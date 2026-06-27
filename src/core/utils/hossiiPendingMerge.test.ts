import { describe, expect, it } from 'vitest';
import type { Hossii } from '../types';
import { mergeFetchedHossiisWithPendingInserts } from './hossiiPendingMerge';
import { buildQueryKey, buildQueryKeyV2 } from './hossiiQueryKey';

const spaceId = 'space-1';
const defaultPaneId = `${spaceId}-pane-default`;
const paneAId = `${spaceId}-pane-a`;

function refs(pendingIds: string[], backup: Map<string, Hossii>) {
  return {
    pendingInsertIdsRef: { current: new Set(pendingIds) },
    pendingOptimisticByIdRef: { current: backup },
  };
}

function h(
  id: string,
  spacePaneId?: string | null,
): Hossii {
  return {
    id,
    message: id,
    spaceId,
    spacePaneId: spacePaneId ?? undefined,
    createdAt: new Date(),
  };
}

describe('mergeFetchedHossiisWithPendingInserts', () => {
  const defaultKey = buildQueryKeyV2(spaceId, { kind: 'pane', paneId: defaultPaneId }, '1w');
  const paneAKey = buildQueryKeyV2(spaceId, { kind: 'pane', paneId: paneAId }, '1w');
  const allKey = buildQueryKeyV2(spaceId, { kind: 'all-panes' }, 'all');
  const v1Key = buildQueryKey(spaceId, '1w');

  it('includes NULL pending in default pane key merge only', () => {
    const pending = h('pending-null');
    const { pendingInsertIdsRef, pendingOptimisticByIdRef } = refs(
      ['pending-null'],
      new Map([['pending-null', pending]]),
    );

    const serverList = [h('server-1')];

    const defaultMerged = mergeFetchedHossiisWithPendingInserts(
      serverList,
      spaceId,
      [],
      pendingInsertIdsRef,
      pendingOptimisticByIdRef,
      defaultKey,
    );
    expect(defaultMerged.map((x) => x.id).sort()).toEqual(['pending-null', 'server-1'].sort());

    const paneAMerged = mergeFetchedHossiisWithPendingInserts(
      serverList,
      spaceId,
      [],
      pendingInsertIdsRef,
      pendingOptimisticByIdRef,
      paneAKey,
    );
    expect(paneAMerged.map((x) => x.id)).toEqual(['server-1']);
  });

  it('excludes pane A pending from default pane key merge', () => {
    const pending = h('pending-a', paneAId);
    const { pendingInsertIdsRef, pendingOptimisticByIdRef } = refs(
      ['pending-a'],
      new Map([['pending-a', pending]]),
    );
    const serverList = [h('server-1')];

    const defaultMerged = mergeFetchedHossiisWithPendingInserts(
      serverList,
      spaceId,
      [],
      pendingInsertIdsRef,
      pendingOptimisticByIdRef,
      defaultKey,
    );
    expect(defaultMerged.map((x) => x.id)).toEqual(['server-1']);
  });

  it('includes pane A pending in pane A and all-panes keys', () => {
    const pending = h('pending-a', paneAId);
    const { pendingInsertIdsRef, pendingOptimisticByIdRef } = refs(
      ['pending-a'],
      new Map([['pending-a', pending]]),
    );
    const serverList: Hossii[] = [];

    const paneAMerged = mergeFetchedHossiisWithPendingInserts(
      serverList,
      spaceId,
      [],
      pendingInsertIdsRef,
      pendingOptimisticByIdRef,
      paneAKey,
    );
    expect(paneAMerged.map((x) => x.id)).toEqual(['pending-a']);

    const allMerged = mergeFetchedHossiisWithPendingInserts(
      serverList,
      spaceId,
      [],
      pendingInsertIdsRef,
      pendingOptimisticByIdRef,
      allKey,
    );
    expect(allMerged.map((x) => x.id)).toEqual(['pending-a']);
  });

  it('v1 key treats pending as all-panes scope', () => {
    const pending = h('pending-null');
    const { pendingInsertIdsRef, pendingOptimisticByIdRef } = refs(
      ['pending-null'],
      new Map([['pending-null', pending]]),
    );

    const merged = mergeFetchedHossiisWithPendingInserts(
      [],
      spaceId,
      [],
      pendingInsertIdsRef,
      pendingOptimisticByIdRef,
      v1Key,
    );
    expect(merged.map((x) => x.id)).toEqual(['pending-null']);
  });

  it('invalid key falls back to space match without throwing', () => {
    const pending = h('pending-null');
    const { pendingInsertIdsRef, pendingOptimisticByIdRef } = refs(
      ['pending-null'],
      new Map([['pending-null', pending]]),
    );

    const merged = mergeFetchedHossiisWithPendingInserts(
      [],
      spaceId,
      [],
      pendingInsertIdsRef,
      pendingOptimisticByIdRef,
      'invalid-key',
    );
    expect(merged.map((x) => x.id)).toEqual(['pending-null']);
  });
});
