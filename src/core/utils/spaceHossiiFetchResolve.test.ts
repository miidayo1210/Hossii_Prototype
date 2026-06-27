import { describe, expect, it } from 'vitest';
import {
  paneFetchScopeOverrideKey,
  resolveSpaceHossiiPaneFilter,
  resolveSpaceHossiiQueryKey,
} from './spaceHossiiFetchResolve';

const spaceId = 'space-1';
const defaultPaneId = 'pane-default';
const paneAId = 'pane-a';
const paneContext = {
  spaceId,
  activePaneId: paneAId,
  defaultPaneId,
};

describe('spaceHossiiFetchResolve', () => {
  describe('resolveSpaceHossiiQueryKey', () => {
    it('uses paneContext when override is context', () => {
      expect(
        resolveSpaceHossiiQueryKey(spaceId, 'all', paneContext, { mode: 'context' }),
      ).toBe(`${spaceId}:pane:${paneAId}:all:v2`);
    });

    it('uses all-panes override', () => {
      expect(
        resolveSpaceHossiiQueryKey(spaceId, 'all', paneContext, { mode: 'all-panes' }),
      ).toBe(`${spaceId}:pane:*:all:v2`);
    });

    it('uses specific pane override', () => {
      expect(
        resolveSpaceHossiiQueryKey(spaceId, 'all', null, {
          mode: 'pane',
          paneId: defaultPaneId,
          defaultPaneId,
        }),
      ).toBe(`${spaceId}:pane:${defaultPaneId}:all:v2`);
    });
  });

  describe('resolveSpaceHossiiPaneFilter', () => {
    it('returns all-panes for override', () => {
      expect(
        resolveSpaceHossiiPaneFilter(paneContext, { mode: 'all-panes' }),
      ).toEqual({ kind: 'all-panes' });
    });

    it('returns default scope for default pane override', () => {
      expect(
        resolveSpaceHossiiPaneFilter(null, {
          mode: 'pane',
          paneId: defaultPaneId,
          defaultPaneId,
        }),
      ).toEqual({ kind: 'default', defaultPaneId });
    });

    it('returns pane scope for additional pane override', () => {
      expect(
        resolveSpaceHossiiPaneFilter(null, {
          mode: 'pane',
          paneId: paneAId,
          defaultPaneId,
        }),
      ).toEqual({ kind: 'pane', paneId: paneAId });
    });

    it('uses paneContext for default active pane', () => {
      expect(
        resolveSpaceHossiiPaneFilter({
          spaceId,
          activePaneId: defaultPaneId,
          defaultPaneId,
        }),
      ).toEqual({ kind: 'default', defaultPaneId });
    });
  });

  describe('paneFetchScopeOverrideKey', () => {
    it('serializes override modes', () => {
      expect(paneFetchScopeOverrideKey({ mode: 'context' })).toBe('context');
      expect(paneFetchScopeOverrideKey({ mode: 'all-panes' })).toBe('all-panes');
      expect(
        paneFetchScopeOverrideKey({
          mode: 'pane',
          paneId: paneAId,
          defaultPaneId,
        }),
      ).toBe(`pane:${paneAId}:${defaultPaneId}`);
    });
  });
});
