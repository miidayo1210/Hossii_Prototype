import type { CustomEmotion, SpaceBackground, SpaceDecoration } from './space';
import type { PostFieldSettings } from './settings';

/** Pane-level override for post form settings (Phase 3+ resolver). */
export type SpacePaneSettingsOverride = {
  postFields?: Partial<PostFieldSettings>;
};

export type SpacePane = {
  id: string;
  spaceId: string;
  name: string;
  slug: string;
  sortOrder: number;
  isDefault: boolean;
  isVisible: boolean;
  background?: SpaceBackground | null;
  savedBackgroundImages?: string[] | null;
  decorations?: SpaceDecoration[] | null;
  characterImageUrl?: string | null;
  characterName?: string | null;
  customEmotions?: CustomEmotion[] | null;
  bubbleShapePng?: string | null;
  settings?: SpacePaneSettingsOverride | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateSpacePaneInput = {
  id: string;
  spaceId: string;
  name: string;
  slug: string;
  sortOrder?: number;
  isDefault?: boolean;
  isVisible?: boolean;
  background?: SpaceBackground | null;
  savedBackgroundImages?: string[] | null;
  decorations?: SpaceDecoration[] | null;
  characterImageUrl?: string | null;
  characterName?: string | null;
  customEmotions?: CustomEmotion[] | null;
  bubbleShapePng?: string | null;
  settings?: SpacePaneSettingsOverride | null;
};

export type UpdateSpacePanePatch = Partial<
  Omit<CreateSpacePaneInput, 'id' | 'spaceId'>
>;
