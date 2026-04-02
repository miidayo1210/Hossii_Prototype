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

export type SpaceSettings = {
  spaceId: string;
  spaceName: string;
  features: SpaceFeatures;
  cardType: CardType;
  hossiiColor: HossiiColor;
  bubbleEditPermission: BubbleEditPermission;
  bottleFrequency: BottleFrequency;
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
};
