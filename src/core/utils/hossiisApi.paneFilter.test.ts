import { describe, expect, it } from 'vitest';
import {
  buildDefaultPaneFetchOrFilter,
  matchesPaneFetchScope,
  type PaneFetchScope,
} from './hossiisApi';

const defaultPaneId = 'space-1-pane-default';
const paneAId = 'space-1-pane-a';

describe('hossiisApi pane filter', () => {
  it('buildDefaultPaneFetchOrFilter uses default pane id only', () => {
    expect(buildDefaultPaneFetchOrFilter(defaultPaneId)).toBe(
      `space_pane_id.eq.${defaultPaneId}`,
    );
  });

  describe('matchesPaneFetchScope', () => {
    const defaultScope: PaneFetchScope = { kind: 'default', defaultPaneId };
    const paneAScope: PaneFetchScope = { kind: 'pane', paneId: paneAId };
    const allScope: PaneFetchScope = { kind: 'all-panes' };

    it('default scope accepts explicit default pane id only', () => {
      expect(matchesPaneFetchScope({ spacePaneId: undefined }, defaultScope)).toBe(false);
      expect(matchesPaneFetchScope({ spacePaneId: null }, defaultScope)).toBe(false);
      expect(matchesPaneFetchScope({ spacePaneId: defaultPaneId }, defaultScope)).toBe(true);
      expect(matchesPaneFetchScope({ spacePaneId: paneAId }, defaultScope)).toBe(false);
    });

    it('pane scope accepts exact pane id only', () => {
      expect(matchesPaneFetchScope({ spacePaneId: paneAId }, paneAScope)).toBe(true);
      expect(matchesPaneFetchScope({ spacePaneId: undefined }, paneAScope)).toBe(false);
      expect(matchesPaneFetchScope({ spacePaneId: defaultPaneId }, paneAScope)).toBe(false);
    });

    it('all-panes accepts any pane id', () => {
      expect(matchesPaneFetchScope({ spacePaneId: undefined }, allScope)).toBe(true);
      expect(matchesPaneFetchScope({ spacePaneId: paneAId }, allScope)).toBe(true);
    });
  });
});
