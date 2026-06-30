import type { Space } from '../types/space';
import type { SpacePane } from '../types/spacePane';
import { isSupabaseConfigured } from '../supabase';
import { updateSpaceInDb } from './spacesApi';
import { updateSpacePane } from './spacePanesApi';
import { getAdditionalPanes, type BackgroundBoardDraft } from './backgroundBoard';
import { PaneOverrideSaveError } from './savePaneSettingOverride';

export type BackgroundBoardSaveContext = {
  space: Space;
  panes: SpacePane[];
  onUpdateSpace: (patch: Partial<Space>) => void;
  reloadPanesAndSyncActive: () => Promise<void>;
};

function draftsEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function assertSupabase(): void {
  if (!isSupabaseConfigured) {
    throw new PaneOverrideSaveError(
      '背景ボードの保存には Supabase 接続が必要です。',
    );
  }
}

export async function saveBackgroundBoard(
  ctx: BackgroundBoardSaveContext,
  draft: BackgroundBoardDraft,
  initial: BackgroundBoardDraft,
): Promise<void> {
  assertSupabase();

  const mainChanged = !draftsEqual(initial.main, draft.main);
  if (mainChanged) {
    const patch = {
      background: draft.main.background,
      savedBackgroundImages: draft.main.savedBackgroundImages,
    };
    ctx.onUpdateSpace(patch);
    await updateSpaceInDb(ctx.space.id, patch);
  }

  const additionalPanes = getAdditionalPanes(ctx.panes);
  const changedPanes = additionalPanes.filter((pane) => {
    const prev = initial.paneOverrides[pane.id] ?? null;
    const next = draft.paneOverrides[pane.id] ?? null;
    return !draftsEqual(prev, next);
  });

  for (const pane of changedPanes) {
    const background = draft.paneOverrides[pane.id] ?? null;
    const result = await updateSpacePane(pane.id, { background });
    if (!result) {
      throw new PaneOverrideSaveError('タブ背景の保存に失敗しました。');
    }
  }

  if (changedPanes.length > 0) {
    await ctx.reloadPanesAndSyncActive();
  }
}
