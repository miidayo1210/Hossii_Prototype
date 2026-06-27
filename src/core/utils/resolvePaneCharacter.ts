import type { CustomEmotion, Space } from '../types/space';
import type { SpacePane } from '../types/spacePane';

export type ResolvedPaneCharacter = {
  characterImageUrl?: string;
  characterName?: string;
  customEmotions: CustomEmotion[];
};

/**
 * Resolves center character fields. Default pane uses space columns;
 * additional panes inherit per-field when pane column is null.
 */
export function resolvePaneCharacter(
  pane: SpacePane | null,
  space: Space | null | undefined,
): ResolvedPaneCharacter {
  if (!space) {
    return { customEmotions: [] };
  }

  if (!pane || pane.isDefault) {
    return {
      characterImageUrl: space.characterImageUrl,
      characterName: space.characterName,
      customEmotions: space.customEmotions ?? [],
    };
  }

  return {
    characterImageUrl: pane.characterImageUrl ?? space.characterImageUrl,
    characterName: pane.characterName ?? space.characterName,
    customEmotions: pane.customEmotions ?? space.customEmotions ?? [],
  };
}
