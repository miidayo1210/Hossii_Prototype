// スペース設定の型定義

export type CardType = 'stamp' | 'constellation' | 'graph';

export type BottleFrequency = '1d' | '3d-7d' | '2w' | '1m' | 'off';

export type HossiiColor = 'pink' | 'blue' | 'yellow' | 'green' | 'purple';

export type SpaceFeatures = {
  commentPost: boolean;
  emotionPost: boolean;
  photoPost: boolean;
  numberPost: boolean;
  likesEnabled: boolean;
};

// バブル編集権限: 'all' = 全員可, 'owner_and_admin' = 投稿者本人と管理者のみ
export type BubbleEditPermission = 'all' | 'owner_and_admin';

export type PostFieldConfig = {
  enabled: boolean;
  required: boolean;
};

export type PostFieldSettings = {
  message: PostFieldConfig;
  emotion: PostFieldConfig;
  tags: PostFieldConfig;
  photo: PostFieldConfig;
  bubbleColor: PostFieldConfig;
  bubbleShape: PostFieldConfig;
  numberPost: PostFieldConfig;
};

export const DEFAULT_POST_FIELD_SETTINGS: PostFieldSettings = {
  message: { enabled: true, required: false },
  emotion: { enabled: true, required: false },
  tags: { enabled: true, required: false },
  photo: { enabled: true, required: false },
  bubbleColor: { enabled: true, required: false },
  bubbleShape: { enabled: true, required: false },
  numberPost: { enabled: false, required: false },
};

export type SpaceSettings = {
  spaceId: string;
  spaceName: string;
  features: SpaceFeatures;
  cardType: CardType;
  hossiiColor: HossiiColor;
  bubbleEditPermission: BubbleEditPermission;
  bottleFrequency: BottleFrequency;
  postFields?: PostFieldSettings;
};

export const DEFAULT_SPACE_FEATURES: SpaceFeatures = {
  commentPost: true,
  emotionPost: true,
  photoPost: true,
  numberPost: false,
  likesEnabled: true,
};

export const DEFAULT_SPACE_SETTINGS: Omit<SpaceSettings, 'spaceId' | 'spaceName'> = {
  features: DEFAULT_SPACE_FEATURES,
  cardType: 'constellation',
  hossiiColor: 'pink',
  bubbleEditPermission: 'all',
  bottleFrequency: '3d-7d',
  postFields: DEFAULT_POST_FIELD_SETTINGS,
};
