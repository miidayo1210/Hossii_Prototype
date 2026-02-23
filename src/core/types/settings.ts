// スペース設定の型定義

export type CardType = 'stamp' | 'constellation' | 'graph';

export type HossiiColor = 'pink' | 'blue' | 'yellow' | 'green' | 'purple';

export type BackgroundPattern = 'standard' | 'nebula' | 'galaxy' | 'stars';

export type SpaceFeatures = {
  commentPost: boolean;
  emotionPost: boolean;
  photoPost: boolean;
  numberPost: boolean;
};

export type SpaceSettings = {
  spaceId: string;
  spaceName: string;
  features: SpaceFeatures;
  cardType: CardType;
  hossiiColor: HossiiColor;
  backgroundPattern: BackgroundPattern;
};

export const DEFAULT_SPACE_FEATURES: SpaceFeatures = {
  commentPost: true,
  emotionPost: true,
  photoPost: true,
  numberPost: false,
};

export const DEFAULT_SPACE_SETTINGS: Omit<SpaceSettings, 'spaceId' | 'spaceName'> = {
  features: DEFAULT_SPACE_FEATURES,
  cardType: 'constellation',
  hossiiColor: 'pink',
  backgroundPattern: 'standard',
};
