import type { CustomEmotion, SpaceBackground, SpaceDecoration } from './space';
import type { PostFieldSettings, PostingSettings } from './settings';

export type SpacePaneTabBarSettings = {
  /**
   * 'bar' (default/omitted) — shown on tab bar.
   * 'basket' — legacy 100B value; maps to default folder.
   * 'folder' — placed in a named tab folder (100C).
   */
  group?: 'bar' | 'basket' | 'folder';
  /** Required when group === 'folder'. Falls back to DEFAULT_FOLDER_ID if missing. */
  folderId?: string;
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
