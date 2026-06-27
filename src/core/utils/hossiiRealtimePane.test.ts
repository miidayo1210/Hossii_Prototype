import { describe, expect, it } from 'vitest';
import type { SpacePaneRuntime } from '../hooks/spacePaneRuntime';
import type { Hossii } from '../types';
import {
  classifyRealtimeUpdate,
  isActive,
  shouldAcceptRealtimeInsert,
  wasActive,
} from './hossiiRealtimePane';

const spaceId = 'space-1';
const defaultPaneId = `${spaceId}-pane-default`;
const paneAId = `${spaceId}-pane-a`;
const paneBId = `${spaceId}-pane-b`;

function runtime(overrides: Partial<SpacePaneRuntime> = {}): SpacePaneRuntime {
  return {
    spaceId,
    activePaneId: defaultPaneId,
    defaultPaneId,
    ...overrides,
  };
}

function h(
  overrides: Partial<Hossii> & Pick<Hossii, 'id'>,
): Pick<Hossii, 'id' | 'spaceId' | 'spacePaneId' | 'isHidden'> {
  return {
    spaceId,
    spacePaneId: undefined,
    isHidden: false,
    ...overrides,
  };
}

describe('hossiiRealtimePane', () => {
  describe('shouldAcceptRealtimeInsert', () => {
    it('accepts insert matching active default pane', () => {
      expect(
        shouldAcceptRealtimeInsert(h({ id: '1' }), runtime(), spaceId),
      ).toBe(true);
      expect(
        shouldAcceptRealtimeInsert(
          h({ id: '2', spacePaneId: defaultPaneId }),
          runtime(),
          spaceId,
        ),
      ).toBe(true);
    });

    it('rejects insert for non-active pane', () => {
      expect(
        shouldAcceptRealtimeInsert(
          h({ id: 'a', spacePaneId: paneAId }),
          runtime(),
          spaceId,
        ),
      ).toBe(false);
    });

    it('accepts insert for active additional pane', () => {
      expect(
        shouldAcceptRealtimeInsert(
          h({ id: 'a', spacePaneId: paneAId }),
          runtime({ activePaneId: paneAId }),
          spaceId,
        ),
      ).toBe(true);
    });

    it('rejects when runtime space mismatches', () => {
      expect(
        shouldAcceptRealtimeInsert(h({ id: '1' }), runtime({ spaceId: 'other' }), spaceId),
      ).toBe(false);
    });

    it('rejects when defaultPaneId unresolved', () => {
      expect(
        shouldAcceptRealtimeInsert(
          h({ id: '1' }),
          runtime({ defaultPaneId: null }),
          spaceId,
        ),
      ).toBe(false);
    });

    it('rejects hidden insert', () => {
      expect(
        shouldAcceptRealtimeInsert(
          h({ id: '1', isHidden: true }),
          runtime(),
          spaceId,
        ),
      ).toBe(false);
    });
  });

  describe('classifyRealtimeUpdate', () => {
    it('patchOnly when both before and after active', () => {
      const post = h({ id: 'x', spacePaneId: paneAId });
      expect(
        classifyRealtimeUpdate(
          post,
          { ...post, spacePaneId: paneAId },
          runtime({ activePaneId: paneAId }),
        ),
      ).toBe('patchOnly');
    });

    it('removeFromActive when pane moves away from active', () => {
      const before = h({ id: 'x', spacePaneId: paneAId });
      const after = h({ id: 'x', spacePaneId: paneBId });
      expect(
        classifyRealtimeUpdate(
          before,
          after,
          runtime({ activePaneId: paneAId }),
        ),
      ).toBe('removeFromActive');
    });

    it('addToActive when pane moves into active', () => {
      const before = h({ id: 'x', spacePaneId: paneBId });
      const after = h({ id: 'x', spacePaneId: paneAId });
      expect(
        classifyRealtimeUpdate(
          before,
          after,
          runtime({ activePaneId: paneAId }),
        ),
      ).toBe('addToActive');
    });

    it('ignore when neither before nor after active', () => {
      const before = h({ id: 'x', spacePaneId: paneBId });
      const after = h({ id: 'x', spacePaneId: paneBId });
      expect(
        classifyRealtimeUpdate(
          before,
          after,
          runtime({ activePaneId: paneAId }),
        ),
      ).toBe('ignore');
    });

    it('removeFromActive when hidden on active pane', () => {
      const before = h({ id: 'x', spacePaneId: paneAId });
      const after = h({ id: 'x', spacePaneId: paneAId, isHidden: true });
      expect(
        classifyRealtimeUpdate(
          before,
          after,
          runtime({ activePaneId: paneAId }),
        ),
      ).toBe('removeFromActive');
    });
  });

  describe('wasActive / isActive', () => {
    it('NULL legacy post is active on default pane', () => {
      const post = h({ id: 'legacy' });
      expect(wasActive(post, runtime())).toBe(true);
      expect(isActive(post, runtime())).toBe(true);
    });
  });
});
