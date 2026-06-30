import type { CustomEmotion, SpaceBackground, SpaceDecoration } from './space';
import type { PostFieldSettings, PostingSettings } from './settings';

export type SpacePaneTabBarSettings = {
  /** Omitted or 'bar' — shown on tab bar. 'basket' — tucked in 🧺. */
  group?: 'bar' | 'basket';
};

/** Pane-level override stored in space_panes.settings JSON (Phase 7). */
export type SpacePaneSettingsOverride = {
  postFields?: Partial<PostFieldSettings> | null;
  posting?: Pick<PostingSettings, 'positionMode'> | null;
  tabBar?: SpacePaneTabBarSettings | null;
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
