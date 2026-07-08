import type { PostFieldSettings, PostingSettings } from '../types/settings';
import type { SpaceBackground, SpaceDecoration, CustomEmotion } from '../types/space';
import type { SpacePane, SpacePaneSettingsOverride, UpdateSpacePanePatch } from '../types/spacePane';

export const PANE_OVERRIDE_COLUMN_KEYS = [
  'background',
  'savedBackgroundImages',
  'decorations',
  'characterImageUrl',
  'characterName',
  'customEmotions',
  'bubbleShapePng',
] as const;

export type PaneColumnOverrideKey = (typeof PANE_OVERRIDE_COLUMN_KEYS)[number];

export type PaneSettingsJsonField = 'postFields' | 'positionMode';

export function isDefaultPane(pane: SpacePane): boolean {
  return pane.isDefault;
}

export function isAdditionalPane(pane: SpacePane): boolean {
  return !pane.isDefault;
}

export function hasPaneColumnOverride(
  pane: SpacePane,
  key: PaneColumnOverrideKey,
): boolean {
  if (pane.isDefault) return false;
  return pane[key] != null;
}

export function hasPanePostFieldsOverride(pane: SpacePane): boolean {
  if (pane.isDefault) return false;
  return pane.settings?.postFields != null;
}

export function hasPanePositionModeOverride(pane: SpacePane): boolean {
  if (pane.isDefault) return false;
  return pane.settings?.posting?.positionMode != null;
}

export function mergePaneSettingsOverride(
  current: SpacePaneSettingsOverride | null | undefined,
  patch: Partial<{
    postFields: Partial<PostFieldSettings> | null;
    posting: { positionMode?: PostingSettings['positionMode'] | null } | null;
  }>,
): SpacePaneSettingsOverride | null {
  let postFields = current?.postFields ?? null;
  let positionMode: PostingSettings['positionMode'] | undefined = current?.posting?.positionMode;

  if ('postFields' in patch) {
    postFields = patch.postFields ?? null;
  }
  if ('posting' in patch) {
    if (patch.posting == null) {
      positionMode = undefined;
    } else if (patch.posting.positionMode === null) {
      positionMode = undefined;
    } else if (patch.posting.positionMode !== undefined) {
      positionMode = patch.posting.positionMode;
    }
  }

  const result: SpacePaneSettingsOverride = {};
  if (postFields != null) result.postFields = postFields;
  if (positionMode != null) result.posting = { positionMode };

  return Object.keys(result).length > 0 ? result : null;
}

export function buildPaneSettingsPatch(
  pane: SpacePane,
  field: PaneSettingsJsonField,
  value: Partial<PostFieldSettings> | null | PostingSettings['positionMode'] | null,
): UpdateSpacePanePatch {
  if (field === 'postFields') {
    return {
      settings: mergePaneSettingsOverride(pane.settings, {
        postFields: value as Partial<PostFieldSettings> | null,
      }),
    };
  }

  if (value === null) {
    return {
      settings: mergePaneSettingsOverride(pane.settings, {
        posting: { positionMode: null },
      }),
    };
  }

  return {
    settings: mergePaneSettingsOverride(pane.settings, {
      posting: { positionMode: value as PostingSettings['positionMode'] },
    }),
  };
}

export function buildPaneColumnResetPatch(
  key: PaneColumnOverrideKey,
): UpdateSpacePanePatch {
  return { [key]: null } as UpdateSpacePanePatch;
}

export type PaneBackgroundValue = {
  background?: SpaceBackground;
  savedBackgroundImages?: string[];
};

export function buildPaneBackgroundPatch(
  value: PaneBackgroundValue,
  reset = false,
): UpdateSpacePanePatch {
  if (reset) {
    return { background: null, savedBackgroundImages: null };
  }
  const patch: UpdateSpacePanePatch = {};
  if (value.background !== undefined) patch.background = value.background ?? null;
  if (value.savedBackgroundImages !== undefined) {
    patch.savedBackgroundImages = value.savedBackgroundImages ?? null;
  }
  return patch;
}

export function buildPaneDecorationsPatch(
  decorations: SpaceDecoration[] | null,
): UpdateSpacePanePatch {
  return { decorations };
}

export function buildPaneCharacterPatch(patch: {
  characterName?: string | null;
  characterImageUrl?: string | null;
  customEmotions?: CustomEmotion[] | null;
}): UpdateSpacePanePatch {
  const result: UpdateSpacePanePatch = {};
  if ('characterName' in patch) result.characterName = patch.characterName ?? null;
  if ('characterImageUrl' in patch) result.characterImageUrl = patch.characterImageUrl ?? null;
  if ('customEmotions' in patch) result.customEmotions = patch.customEmotions ?? null;
  return result;
}

export function buildPaneBubbleShapePatch(
  bubbleShapePng: string | null,
): UpdateSpacePanePatch {
  return { bubbleShapePng };
}

export type BubbleShapePngPatch =
  | { bubbleShapePng: string }
  | { bubbleShapePng: null }
  | Record<string, never>;

/** Build a bubble-shape update only when the value actually changed. */
export function buildBubbleShapePngPatch(
  previous: string | null | undefined,
  next: string | null,
): BubbleShapePngPatch {
  const prev = previous ?? null;
  if (prev === next) return {};
  if (next === null) return { bubbleShapePng: null };
  return { bubbleShapePng: next };
}

export function bubbleShapePngPatchValue(
  patch: BubbleShapePngPatch,
): string | null | undefined {
  if (!('bubbleShapePng' in patch)) return undefined;
  return patch.bubbleShapePng;
}
