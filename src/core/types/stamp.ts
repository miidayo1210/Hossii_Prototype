// スタンプカード関連の型定義

export type StampCardTheme = 'grid' | 'spiral' | 'wave' | 'starry' | 'circle';

export const STAMPS_PER_CARD = 20;

export type StampData = {
  userId: string;
  count: number;
  lastUpdated: Date;
};

export type StampCardSettings = {
  theme: StampCardTheme;
};
