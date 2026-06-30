import { describe, expect, it } from 'vitest';
import type { Space } from '../types/space';
import type { SpacePane } from '../types/spacePane';
import {
  applyAllPanesToMain,
  applyAllPanesToPoolIndex,
  buildInitialBackgroundBoardDraft,
  getAdditionalPaneIds,
  getAdditionalPanes,
  getPaneAssignment,
  resolveDraftPaneBackground,
  setPaneAssignment,
} from './backgroundBoard';

const poolUrl1 = 'https://example.com/bg1.jpg';
const poolUrl2 = 'https://example.com/bg2.jpg';
const orphanUrl = 'https://example.com/orphan.jpg';

const spaceBg = { kind: 'color' as const, value: '#EAF4FF' };

const baseSpace: Space = {
  id: 'space-1',
  name: 'Test',
  spaceURL: 'test-space',
  background: spaceBg,
  savedBackgroundImages: [poolUrl1, poolUrl2],
  createdAt: new Date(),
};

const defaultPane: SpacePane = {
  id: 'pane-default',
  spaceId: 'space-1',
  name: 'メイン',
  slug: 'main',
  sortOrder: 0,
  isDefault: true,
  isVisible: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const extraPane: SpacePane = {
  ...defaultPane,
  id: 'pane-2',
  name: 'Ideas',
  slug: 'ideas',
  isDefault: false,
};

describe('getAdditionalPanes', () => {
  it('excludes the default pane even when isDefault flags are missing', () => {
    const paneA = { ...defaultPane, id: 'pane-a', name: 'First', isDefault: false };
    const paneB = { ...extraPane, id: 'pane-b', name: 'Second', isDefault: false };
    const additional = getAdditionalPanes([paneA, paneB]);
    expect(additional).toEqual([paneB]);
    expect(getAdditionalPaneIds([paneA, paneB])).toEqual(['pane-b']);
  });
});

describe('buildInitialBackgroundBoardDraft', () => {
  it('normalizes pool-outside pane override to null', () => {
    const pane = {
      ...extraPane,
      background: { kind: 'image' as const, value: orphanUrl, source: 'cloud' as const },
    };
    const draft = buildInitialBackgroundBoardDraft(baseSpace, [defaultPane, pane]);
    expect(draft.paneOverrides['pane-2']).toBeNull();
    expect(getPaneAssignment('pane-2', draft)).toBe('main');
  });

  it('preserves valid pool image override', () => {
    const pane = {
      ...extraPane,
      background: { kind: 'image' as const, value: poolUrl2, source: 'cloud' as const },
    };
    const draft = buildInitialBackgroundBoardDraft(baseSpace, [defaultPane, pane]);
    expect(getPaneAssignment('pane-2', draft)).toBe(1);
  });
});

describe('setPaneAssignment', () => {
  it('assigns pool image by index', () => {
    const draft = buildInitialBackgroundBoardDraft(baseSpace, [defaultPane, extraPane]);
    const next = setPaneAssignment(draft, 'pane-2', 0);
    expect(next.paneOverrides['pane-2']).toEqual({
      kind: 'image',
      value: poolUrl1,
      source: 'cloud',
    });
  });

  it('no-ops when pool slot is empty', () => {
    const draft = buildInitialBackgroundBoardDraft(
      { ...baseSpace, savedBackgroundImages: [] },
      [defaultPane, extraPane],
    );
    const next = setPaneAssignment(draft, 'pane-2', 0);
    expect(next).toEqual(draft);
  });
});

describe('bulk apply', () => {
  it('applyAllPanesToMain clears all additional overrides', () => {
    let draft = buildInitialBackgroundBoardDraft(baseSpace, [defaultPane, extraPane]);
    draft = setPaneAssignment(draft, 'pane-2', 1);
    const next = applyAllPanesToMain(draft, ['pane-2']);
    expect(next.paneOverrides['pane-2']).toBeNull();
  });

  it('applyAllPanesToPoolIndex assigns all additional panes', () => {
    const draft = buildInitialBackgroundBoardDraft(baseSpace, [defaultPane, extraPane]);
    const next = applyAllPanesToPoolIndex(draft, ['pane-2'], 0);
    expect(next.paneOverrides['pane-2']?.kind).toBe('image');
    expect((next.paneOverrides['pane-2'] as { value: string }).value).toBe(poolUrl1);
  });
});

describe('resolveDraftPaneBackground', () => {
  it('reflects main background change for pane following main', () => {
    const draft = buildInitialBackgroundBoardDraft(baseSpace, [defaultPane, extraPane]);
    const nextMain = {
      ...draft,
      main: {
        ...draft.main,
        background: { kind: 'pattern' as const, value: 'dots' as const },
      },
    };
    const resolved = resolveDraftPaneBackground(extraPane, nextMain, baseSpace);
    expect(resolved).toEqual({ kind: 'pattern', value: 'dots' });
  });

  it('keeps pool image when main changes color', () => {
    let draft = buildInitialBackgroundBoardDraft(baseSpace, [defaultPane, extraPane]);
    draft = setPaneAssignment(draft, 'pane-2', 1);
    draft = {
      ...draft,
      main: {
        ...draft.main,
        background: { kind: 'pattern' as const, value: 'waves' as const },
      },
    };
    const resolved = resolveDraftPaneBackground(extraPane, draft, baseSpace);
    expect(resolved).toEqual({
      kind: 'image',
      value: poolUrl2,
      source: 'cloud',
    });
  });
});
