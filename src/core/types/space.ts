import type { EmotionKey } from './index';

// Space ID
export type SpaceId = string;

// カードタイプ（スタンプ or 星座）
export type CardType = 'stamp' | 'constellation';

// パターンの種類
export type PatternKey =
  | 'mist'
  | 'dots'
  | 'grid'
  | 'waves'
  | 'stars';

// 画像ソースの種類
export type ImageSource = 'preset' | 'temp' | 'cloud';

// スペースの背景設定
export type SpaceBackground =
  | { kind: 'color'; value: string }                                    // e.g. "#EAF4FF"
  | { kind: 'pattern'; value: PatternKey }                              // e.g. "mist", "dots"
  | { kind: 'image'; value: string; source: ImageSource };              // preset: "/bg/space.jpg", temp: objectURL, cloud: supabase URL

// スペースの型
// quickEmotions は「制限」ではなく「初期表示用クイックボタン」
// 投稿自体は quickEmotions に含まれない emotion も許可
export type Space = {
  id: SpaceId;
  spaceURL?: string;            // パブリックURL用スラッグ（変更可）例: "mornings-team"
  name: string;
  cardType: CardType;
  quickEmotions: EmotionKey[]; // 最大8（UI用、制限ではない）
  createdAt: Date;
  background?: SpaceBackground; // 背景設定（オプショナル）
};

// デフォルトのクイックボタン感情（8種）
export const DEFAULT_QUICK_EMOTIONS: EmotionKey[] = [
  'joy',
  'wow',
  'think',
  'empathy',
  'inspire',
  'laugh',
  'moved',
  'fun',
];

// デフォルトスペースのID
export const DEFAULT_SPACE_ID = 'default-space';

// デフォルト背景
export const DEFAULT_BACKGROUND: SpaceBackground = {
  kind: 'pattern',
  value: 'mist',
};

// デフォルトスペース
export const DEFAULT_SPACE: Space = {
  id: DEFAULT_SPACE_ID,
  spaceURL: 'my-space',
  name: 'わたしのスペース',
  cardType: 'constellation',
  quickEmotions: DEFAULT_QUICK_EMOTIONS,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  background: DEFAULT_BACKGROUND,
};

// TODO: SpaceMemberNickname は後回し
