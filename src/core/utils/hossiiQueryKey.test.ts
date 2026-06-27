import { describe, expect, it } from 'vitest';
import type { Hossii } from '../types';
import { createEmptyEntitiesSlice, setOrderedIdsForQuery } from './hossiiEntitiesState';
import {
  buildQueryKey,
  buildQueryKeyV2,
  hossiiMatchesParsedQueryKey,
  parseQueryKey,
  queryKeysForHossii,
} from './hossiiQueryKey';

const spaceId = 'space-1';
const defaultPaneId = `${spaceId}-pane-default`;
const paneAId = `${spaceId}-pane-a`;

describe('hossiiQueryKey', () => {
  describe('buildQueryKeyV2', () => {
    it('builds pane-scoped v2 key', () => {
      expect(buildQueryKeyV2(spaceId, { kind: 'pane', paneId: defaultPaneId }, '1w')).toBe(
        `${spaceId}:pane:${defaultPaneId}:1w:v2`,
      );
    });

    it('builds all-panes v2 key', () => {
      expect(buildQueryKeyV2(spaceId, { kind: 'all-panes' }, 'all')).toBe(
        `${spaceId}:pane:*:all:v2`,
      );
    });

    it('builds comments screen key for active pane with all period', () => {
      expect(buildQueryKeyV2(spaceId, { kind: 'pane', paneId: paneAId }, 'all')).toBe(
        `${spaceId}:pane:${paneAId}:all:v2`,
      );
    });
  });

  describe('parseQueryKey', () => {
    it('parses v2 pane key', () => {
      const key = buildQueryKeyV2(spaceId, { kind: 'pane', paneId: paneAId }, '1m');
      expect(parseQueryKey(key)).toEqual({
        spaceId,
        paneScope: { kind: 'pane', paneId: paneAId },
        displayPeriod: '1m',
        version: 'v2',
      });
    });

    it('parses v2 all-panes key', () => {
      const key = buildQueryKeyV2(spaceId, { kind: 'all-panes' }, 'all');
      expect(parseQueryKey(key)?.paneScope).toEqual({ kind: 'all-panes' });
    });

    it('parses legacy v1 key as all-panes', () => {
      const key = buildQueryKey(spaceId, '1w');
      expect(parseQueryKey(key)).toEqual({
        spaceId,
        paneScope: { kind: 'all-panes' },
        displayPeriod: '1w',
        version: 'v1',
      });
    });

    it('returns null for invalid keys', () => {
      expect(parseQueryKey('')).toBeNull();
      expect(parseQueryKey('bad-key')).toBeNull();
      expect(parseQueryKey(`${spaceId}:pane:x:invalid-period:v2`)).toBeNull();
    });
  });

  describe('hossiiMatchesParsedQueryKey', () => {
    const defaultKey = parseQueryKey(
      buildQueryKeyV2(spaceId, { kind: 'pane', paneId: defaultPaneId }, 'all'),
    )!;
    const paneAKey = parseQueryKey(
      buildQueryKeyV2(spaceId, { kind: 'pane', paneId: paneAId }, 'all'),
    )!;
    const allKey = parseQueryKey(buildQueryKeyV2(spaceId, { kind: 'all-panes' }, 'all'))!;

    it('default pane post matches default pane key', () => {
      const h: Pick<Hossii, 'spaceId' | 'spacePaneId'> = {
        spaceId,
        spacePaneId: defaultPaneId,
      };
      expect(hossiiMatchesParsedQueryKey(h, defaultKey, defaultPaneId)).toBe(true);
      expect(hossiiMatchesParsedQueryKey(h, paneAKey, defaultPaneId)).toBe(false);
      expect(hossiiMatchesParsedQueryKey(h, allKey, defaultPaneId)).toBe(true);
    });

    it('pane A post matches pane A key only', () => {
      const h: Pick<Hossii, 'spaceId' | 'spacePaneId'> = {
        spaceId,
        spacePaneId: paneAId,
      };
      expect(hossiiMatchesParsedQueryKey(h, paneAKey, defaultPaneId)).toBe(true);
      expect(hossiiMatchesParsedQueryKey(h, defaultKey, defaultPaneId)).toBe(false);
    });
  });

  describe('queryKeysForHossii', () => {
    it('inserts default pane post into default and all-panes keys only', () => {
      const defaultKey = buildQueryKeyV2(spaceId, { kind: 'pane', paneId: defaultPaneId }, '1w');
      const paneAKey = buildQueryKeyV2(spaceId, { kind: 'pane', paneId: paneAId }, '1w');
      const allKey = buildQueryKeyV2(spaceId, { kind: 'all-panes' }, 'all');
      const v1Key = buildQueryKey(spaceId, '1w');

      let slice = createEmptyEntitiesSlice();
      slice = setOrderedIdsForQuery(slice, defaultKey, []);
      slice = setOrderedIdsForQuery(slice, paneAKey, []);
      slice = setOrderedIdsForQuery(slice, allKey, []);
      slice = setOrderedIdsForQuery(slice, v1Key, []);

      const hossii: Hossii = {
        id: 'new',
        message: 'x',
        spaceId,
        spacePaneId: defaultPaneId,
        createdAt: new Date(),
      };

      const keys = queryKeysForHossii(slice, hossii).sort();
      expect(keys).toEqual([allKey, defaultKey, v1Key].sort());
      expect(keys).not.toContain(paneAKey);
    });

    it('pane A post targets pane A and all-panes keys', () => {
      const paneAKey = buildQueryKeyV2(spaceId, { kind: 'pane', paneId: paneAId }, '1w');
      const defaultKey = buildQueryKeyV2(spaceId, { kind: 'pane', paneId: defaultPaneId }, '1w');
      const allKey = buildQueryKeyV2(spaceId, { kind: 'all-panes' }, 'all');

      let slice = createEmptyEntitiesSlice();
      slice = setOrderedIdsForQuery(slice, paneAKey, []);
      slice = setOrderedIdsForQuery(slice, defaultKey, []);
      slice = setOrderedIdsForQuery(slice, allKey, []);

      const hossii: Hossii = {
        id: 'a-post',
        message: 'a',
        spaceId,
        spacePaneId: paneAId,
        createdAt: new Date(),
      };

      const keys = queryKeysForHossii(slice, hossii).sort();
      expect(keys).toEqual([allKey, paneAKey].sort());
    });

    it('ignores unparseable keys without throwing', () => {
      let slice = createEmptyEntitiesSlice();
      slice = setOrderedIdsForQuery(slice, 'totally-invalid', []);
      const hossii: Hossii = {
        id: 'x',
        message: 'x',
        spaceId,
        createdAt: new Date(),
      };
      expect(queryKeysForHossii(slice, hossii)).toEqual([]);
    });
  });
});
