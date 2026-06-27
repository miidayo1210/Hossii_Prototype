import type { PostFieldSettings, SpaceSettings } from '../types/settings';
import type { Space, SpaceBackground, SpaceDecoration, CustomEmotion } from '../types/space';
import type { SpacePane } from '../types/spacePane';
import { isSupabaseConfigured } from '../supabase';
import { updateSpaceInDb } from './spacesApi';
import { updateSpacePane } from './spacePanesApi';
import { upsertSpaceSettings } from './spaceSettingsApi';
import { saveSpaceSettings } from './settingsStorage';
import { mergePostFieldSettings } from './postFieldSettings';
import {
  buildPaneBackgroundPatch,
  buildPaneBubbleShapePatch,
  buildPaneCharacterPatch,
  buildPaneColumnResetPatch,
  buildPaneDecorationsPatch,
  buildPaneSettingsPatch,
  isDefaultPane,
  type PaneColumnOverrideKey,
} from './paneOverrideFields';

export type PaneSettingSaveContext = {
  editPane: SpacePane;
  space: Space;
  settings: SpaceSettings;
  onUpdateSpace: (patch: Partial<Space>) => void;
  onUpdateSettings: (settings: SpaceSettings) => void;
  reloadPanesAndSyncActive: () => Promise<void>;
};

export class PaneOverrideSaveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaneOverrideSaveError';
  }
}

function assertSupabase(): void {
  if (!isSupabaseConfigured) {
    throw new PaneOverrideSaveError(
      'Pane 設定の上書き保存には Supabase 接続が必要です。',
    );
  }
}

async function saveAdditionalPanePatch(
  ctx: PaneSettingSaveContext,
  patch: Parameters<typeof updateSpacePane>[1],
): Promise<void> {
  assertSupabase();
  const result = await updateSpacePane(ctx.editPane.id, patch);
  if (!result) {
    throw new PaneOverrideSaveError('Pane 設定の保存に失敗しました。');
  }
  await ctx.reloadPanesAndSyncActive();
}

export async function savePaneBackgroundOverride(
  ctx: PaneSettingSaveContext,
  value: { background?: SpaceBackground; savedBackgroundImages?: string[] },
): Promise<void> {
  const patch: Partial<Space> = {
    background: value.background,
    savedBackgroundImages: value.savedBackgroundImages,
  };

  if (isDefaultPane(ctx.editPane)) {
    ctx.onUpdateSpace(patch);
    await updateSpaceInDb(ctx.space.id, patch);
    return;
  }

  await saveAdditionalPanePatch(ctx, buildPaneBackgroundPatch(value));
}

export async function resetPaneBackgroundOverride(
  ctx: PaneSettingSaveContext,
): Promise<void> {
  if (isDefaultPane(ctx.editPane)) return;
  await saveAdditionalPanePatch(ctx, buildPaneBackgroundPatch({}, true));
}

export async function savePanePostFieldsOverride(
  ctx: PaneSettingSaveContext,
  postFields: PostFieldSettings,
): Promise<void> {
  const merged = mergePostFieldSettings(postFields);

  if (isDefaultPane(ctx.editPane)) {
    const updated: SpaceSettings = { ...ctx.settings, postFields: merged };
    ctx.onUpdateSettings(updated);
    saveSpaceSettings(updated);
    await upsertSpaceSettings(updated);
    return;
  }

  await saveAdditionalPanePatch(
    ctx,
    buildPaneSettingsPatch(ctx.editPane, 'postFields', merged),
  );
}

export async function resetPanePostFieldsOverride(
  ctx: PaneSettingSaveContext,
): Promise<void> {
  if (isDefaultPane(ctx.editPane)) return;
  await saveAdditionalPanePatch(
    ctx,
    buildPaneSettingsPatch(ctx.editPane, 'postFields', null),
  );
}

export async function savePanePositionModeOverride(
  ctx: PaneSettingSaveContext,
  positionMode: 'auto' | 'selector',
): Promise<void> {
  if (isDefaultPane(ctx.editPane)) {
    const updated: SpaceSettings = {
      ...ctx.settings,
      posting: { ...(ctx.settings.posting ?? { positionMode: 'auto' }), positionMode },
    };
    ctx.onUpdateSettings(updated);
    saveSpaceSettings(updated);
    await upsertSpaceSettings(updated);
    return;
  }

  await saveAdditionalPanePatch(
    ctx,
    buildPaneSettingsPatch(ctx.editPane, 'positionMode', positionMode),
  );
}

export async function resetPanePositionModeOverride(
  ctx: PaneSettingSaveContext,
): Promise<void> {
  if (isDefaultPane(ctx.editPane)) return;
  await saveAdditionalPanePatch(
    ctx,
    buildPaneSettingsPatch(ctx.editPane, 'positionMode', null),
  );
}

export async function savePaneDecorationsOverride(
  ctx: PaneSettingSaveContext,
  decorations: SpaceDecoration[],
): Promise<void> {
  if (isDefaultPane(ctx.editPane)) {
    ctx.onUpdateSpace({ decorations });
    await updateSpaceInDb(ctx.space.id, { decorations });
    return;
  }

  await saveAdditionalPanePatch(ctx, buildPaneDecorationsPatch(decorations));
}

export async function resetPaneDecorationsOverride(
  ctx: PaneSettingSaveContext,
): Promise<void> {
  if (isDefaultPane(ctx.editPane)) return;
  await saveAdditionalPanePatch(ctx, buildPaneDecorationsPatch(null));
}

export async function savePaneCharacterOverride(
  ctx: PaneSettingSaveContext,
  value: {
    characterName?: string;
    characterImageUrl?: string;
    customEmotions?: CustomEmotion[];
  },
): Promise<void> {
  const patch: Partial<Space> = {
    characterName: value.characterName || undefined,
    characterImageUrl: value.characterImageUrl,
    customEmotions: value.customEmotions,
  };

  if (isDefaultPane(ctx.editPane)) {
    ctx.onUpdateSpace(patch);
    await updateSpaceInDb(ctx.space.id, patch);
    return;
  }

  await saveAdditionalPanePatch(
    ctx,
    buildPaneCharacterPatch({
      characterName: value.characterName ?? null,
      characterImageUrl: value.characterImageUrl ?? null,
      customEmotions: value.customEmotions ?? null,
    }),
  );
}

export async function resetPaneCharacterOverride(
  ctx: PaneSettingSaveContext,
): Promise<void> {
  if (isDefaultPane(ctx.editPane)) return;
  await saveAdditionalPanePatch(
    ctx,
    buildPaneCharacterPatch({
      characterName: null,
      characterImageUrl: null,
      customEmotions: null,
    }),
  );
}

export async function savePaneBubbleShapeOverride(
  ctx: PaneSettingSaveContext,
  bubbleShapePng: string | null,
): Promise<void> {
  const spacePatch = bubbleShapePng
    ? { bubbleShapePng }
    : { bubbleShapePng: undefined };

  if (isDefaultPane(ctx.editPane)) {
    ctx.onUpdateSpace(spacePatch);
    await updateSpaceInDb(ctx.space.id, spacePatch);
    return;
  }

  await saveAdditionalPanePatch(
    ctx,
    buildPaneBubbleShapePatch(bubbleShapePng),
  );
}

export async function resetPaneBubbleShapeOverride(
  ctx: PaneSettingSaveContext,
): Promise<void> {
  if (isDefaultPane(ctx.editPane)) return;
  await saveAdditionalPanePatch(ctx, buildPaneBubbleShapePatch(null));
}

export async function resetPaneColumnOverride(
  ctx: PaneSettingSaveContext,
  key: PaneColumnOverrideKey,
): Promise<void> {
  if (isDefaultPane(ctx.editPane)) return;
  await saveAdditionalPanePatch(ctx, buildPaneColumnResetPatch(key));
}
