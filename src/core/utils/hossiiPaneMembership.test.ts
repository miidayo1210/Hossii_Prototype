import { describe, expect, it } from 'vitest';
import type { Hossii } from '../types';
import {
  effectivePaneId,
  isDefaultPane,
  matchesPane,
  type PaneContext,
} from './hossiiPaneMembership';

const defaultPaneId = 'space-1-pane-default';
const paneAId = 'space-1-pane-a';

const defaultContext: PaneContext = {
  spaceId: 'space-1',
  activePaneId: defaultPaneId,
  defaultPaneId,
};

const paneAContext: PaneContext = {
  spaceId: 'space-1',
  activePaneId: paneAId,
  defaultPaneId,
};

function h(
  overrides: Partial<Hossii> & Pick<Hossii, 'id'>,
): Pick<Hossii, 'id' | 'spaceId' | 'spacePaneId'> {
  return {
    spaceId: 'space-1',
    spacePaneId: undefined,
    ...overrides,
  };
}

describe('hossiiPaneMembership', () => {
  it('effectivePaneId maps NULL to defaultPaneId', () => {
    expect(effectivePaneId(h({ id: 'x' }), defaultPaneId)).toBe(defaultPaneId);
  });

  it('effectivePaneId keeps explicit pane id', () => {
    expect(effectivePaneId(h({ id: 'x', spacePaneId: paneAId }), defaultPaneId)).toBe(
      paneAId,
    );
  });

  it('NULL post matches default pane context', () => {
    expect(matchesPane(h({ id: 'null-post' }), defaultContext)).toBe(true);
  });

  it('NULL post does not match additional pane context', () => {
    expect(matchesPane(h({ id: 'null-post' }), paneAContext)).toBe(false);
  });

  it('explicit defaultPaneId matches default pane context', () => {
    expect(
      matchesPane(h({ id: 'def', spacePaneId: defaultPaneId }), defaultContext),
    ).toBe(true);
  });

  it('pane A post matches pane A context only', () => {
    const post = h({ id: 'a', spacePaneId: paneAId });
    expect(matchesPane(post, paneAContext)).toBe(true);
    expect(matchesPane(post, defaultContext)).toBe(false);
  });

  it('cross-space post never matches', () => {
    expect(
      matchesPane(
        h({ id: 'other', spaceId: 'space-2', spacePaneId: paneAId }),
        paneAContext,
      ),
    ).toBe(false);
  });

  it('isDefaultPane when active equals default', () => {
    expect(isDefaultPane(defaultContext)).toBe(true);
    expect(isDefaultPane(paneAContext)).toBe(false);
  });
});
