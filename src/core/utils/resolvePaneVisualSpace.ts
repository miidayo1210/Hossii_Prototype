import type { Space } from '../types/space';
import type { SpacePane } from '../types/spacePane';
import { resolvePaneBackground } from './resolvePaneBackground';
import { resolvePaneBubbleShapePng } from './resolvePaneBubbleShapePng';
import { resolvePaneCharacter } from './resolvePaneCharacter';
import { resolvePaneDecorations } from './resolvePaneDecorations';
import { resolvePaneSavedBackgroundImages } from './resolvePaneSavedBackgroundImages';

/**
 * Merges pane-level visual overrides onto a Space for SpaceScreen rendering.
 * Visiting mode should pass visitingSpaceInfo without pane resolution.
 */
export function resolvePaneVisualSpace(
  pane: SpacePane | null,
  space: Space | null | undefined,
): Space | null | undefined {
  if (!space) return space;

  const character = resolvePaneCharacter(pane, space);

  return {
    ...space,
    background: resolvePaneBackground(pane, space),
    savedBackgroundImages: resolvePaneSavedBackgroundImages(pane, space),
    decorations: resolvePaneDecorations(pane, space),
    bubbleShapePng: resolvePaneBubbleShapePng(pane, space),
    characterImageUrl: character.characterImageUrl,
    characterName: character.characterName,
    customEmotions: character.customEmotions,
  };
}
