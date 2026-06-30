import type { PatternKey, Space, SpaceBackground } from '../types/space';
import { MAX_BACKGROUND_IMAGES } from '../types/space';
import type { SpacePane } from '../types/spacePane';
import {
  COLOR_PRESETS,
  PATTERN_PRESETS,
  THEME_PRESETS,
} from './backgroundPresets';
import { resolvePaneBackground } from './resolvePaneBackground';

export type BackgroundBoardDraft = {
  /** メイン（spaces 正本） */
  main: {
    background?: SpaceBackground;
    savedBackgroundImages?: string[];
  };
  /** 追加 pane の override（paneId → background override or null） */
  paneOverrides: Record<string, SpaceBackground | null>;
};

export type PaneAssignmentSelection = 'main' | 0 | 1 | 2;

function normalizePaneOverride(
  override: SpaceBackground | null | undefined,
  pool: string[],
): SpaceBackground | null {
  if (override == null) return null;
  if (override.kind !== 'image') return null;
  if (!pool.includes(override.value)) return null;
  return { kind: 'image', value: override.value, source: 'cloud' };
}

export function resolveDefaultPane(panes: SpacePane[]): SpacePane | undefined {
  return panes.find((p) => p.isDefault) ?? panes[0];
}

export function getAdditionalPanes(panes: SpacePane[]): SpacePane[] {
  const defaultPane = resolveDefaultPane(panes);
  if (!defaultPane) return [];
  return panes.filter((p) => p.id !== defaultPane.id);
}

export function buildInitialBackgroundBoardDraft(
  space: Space,
  panes: SpacePane[],
): BackgroundBoardDraft {
  const pool = space.savedBackgroundImages ?? [];
  const paneOverrides: Record<string, SpaceBackground | null> = {};

  for (const pane of getAdditionalPanes(panes)) {
    paneOverrides[pane.id] = normalizePaneOverride(pane.background, pool);
  }

  return {
    main: {
      background: space.background,
      savedBackgroundImages: pool,
    },
    paneOverrides,
  };
}

export function getAdditionalPaneIds(panes: SpacePane[]): string[] {
  return getAdditionalPanes(panes).map((p) => p.id);
}

export function getPaneAssignment(
  paneId: string,
  draft: BackgroundBoardDraft,
): PaneAssignmentSelection {
  const override = draft.paneOverrides[paneId];
  if (override == null) return 'main';
  if (override.kind === 'image') {
    const idx = (draft.main.savedBackgroundImages ?? []).indexOf(override.value);
    if (idx >= 0 && idx < MAX_BACKGROUND_IMAGES) {
      return idx as 0 | 1 | 2;
    }
  }
  return 'main';
}

export function setPaneAssignment(
  draft: BackgroundBoardDraft,
  paneId: string,
  selection: PaneAssignmentSelection,
): BackgroundBoardDraft {
  let override: SpaceBackground | null = null;
  if (selection !== 'main') {
    const url = draft.main.savedBackgroundImages?.[selection];
    if (!url) return draft;
    override = { kind: 'image', value: url, source: 'cloud' };
  }
  return {
    ...draft,
    paneOverrides: { ...draft.paneOverrides, [paneId]: override },
  };
}

export function applyAllPanesToMain(
  draft: BackgroundBoardDraft,
  additionalPaneIds: string[],
): BackgroundBoardDraft {
  const paneOverrides = { ...draft.paneOverrides };
  for (const id of additionalPaneIds) {
    paneOverrides[id] = null;
  }
  return { ...draft, paneOverrides };
}

export function applyAllPanesToPoolIndex(
  draft: BackgroundBoardDraft,
  additionalPaneIds: string[],
  index: number,
): BackgroundBoardDraft {
  const url = draft.main.savedBackgroundImages?.[index];
  if (!url) return draft;
  const override: SpaceBackground = { kind: 'image', value: url, source: 'cloud' };
  const paneOverrides = { ...draft.paneOverrides };
  for (const id of additionalPaneIds) {
    paneOverrides[id] = override;
  }
  return { ...draft, paneOverrides };
}

export function resolveDraftPaneBackground(
  pane: SpacePane,
  draft: BackgroundBoardDraft,
  space: Space,
): SpaceBackground | undefined {
  const virtualSpace: Space = {
    ...space,
    background: draft.main.background,
    savedBackgroundImages: draft.main.savedBackgroundImages,
  };
  const virtualPane: SpacePane = pane.isDefault
    ? pane
    : { ...pane, background: draft.paneOverrides[pane.id] ?? null };
  return resolvePaneBackground(virtualPane, virtualSpace);
}

function findPatternLabel(value: PatternKey): string {
  const preset =
    PATTERN_PRESETS.find((p) => p.key === value) ??
    THEME_PRESETS.find((p) => p.key === value);
  return preset?.label ?? value;
}

export function describeBackground(bg: SpaceBackground | undefined): string {
  if (!bg) return '未設定';
  if (bg.kind === 'color') {
    const preset = COLOR_PRESETS.find((p) => p.value === bg.value);
    return preset ? `色「${preset.label}」` : `色 ${bg.value}`;
  }
  if (bg.kind === 'pattern') {
    return `パターン「${findPatternLabel(bg.value)}」`;
  }
  if (bg.kind === 'image') {
    return '画像';
  }
  return '未設定';
}

export function describePaneAssignment(
  paneId: string,
  draft: BackgroundBoardDraft,
): string {
  const selection = getPaneAssignment(paneId, draft);
  if (selection === 'main') return 'メインと同じ';
  return `画像${selection + 1}`;
}

export function poolImageBackground(url: string): SpaceBackground {
  return { kind: 'image', value: url, source: 'cloud' };
}
