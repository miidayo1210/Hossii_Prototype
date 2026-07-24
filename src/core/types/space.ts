import type { EmotionKey } from './index';
import type { TabFolder } from '../utils/tabFolderStorage';
import type { MyHossiiLogVisibility, MyHossiiMotionMode } from './myHossii';

export type { TabFolder };

// Space ID
export type SpaceId = string;

/** 共有URLで未参加者が選べる参加方式（DB: spaces.participation_mode）。personal では無視。 */
export type ParticipationMode = 'guest_only' | 'guest_and_account' | 'account_only';

export type SpaceDecorationType = 'bulletin_board' | 'sign' | 'image';

// パターンの種類
export type PatternKey =
  | 'mist'
  | 'dots'
  | 'grid'
  | 'waves'
  | 'stars'
  | 'nebula'
  | 'galaxy'
  | 'starfield';

// 画像ソースの種類
export type ImageSource = 'preset' | 'temp' | 'cloud';

// スペースの背景設定
export type SpaceBackground =
  | { kind: 'color'; value: string }                                    // e.g. "#EAF4FF"
  | { kind: 'pattern'; value: PatternKey }                              // e.g. "mist", "dots"
  | { kind: 'image'; value: string; source: ImageSource };              // preset: "/bg/space.jpg", temp: objectURL, cloud: supabase URL

// カスタム表情の型
export type CustomEmotion = {
  id: string;
  label?: string;       // 管理者向けラベル（例: 「驚き」「喜び」）
  imageUrl: string;     // Storage URL またはプリセット識別子
  width: number;        // px（40〜200）
  height: number;       // px（40〜200）
};

// スペース装飾の型
export type SpaceDecoration = {
  id: string;
  type: SpaceDecorationType;
  position: { x: number; y: number };
  content: {
    title?: string;
    body: string;
  };
  imageUrl?: string;
  linkUrl?: string;
  width?: number;
  height?: number;
  rotation?: number;
  layer?: number;
  isVisible?: boolean;
  style?: {
    width?: number;
    backgroundColor?: string;
  };
};

// スペースの型
// quickEmotions は「制限」ではなく「初期表示用クイックボタン」
// 投稿自体は quickEmotions に含まれない emotion も許可
export type Space = {
  id: SpaceId;
  spaceURL?: string;            // パブリックURL用スラッグ（変更可）例: "mornings-team"
  name: string;
  quickEmotions: EmotionKey[]; // 最大8（UI用、制限ではない）
  createdAt: Date;
  background?: SpaceBackground; // 背景設定（オプショナル）
  savedBackgroundImages?: string[]; // 保存済み背景画像URLリスト（最大 MAX_BACKGROUND_IMAGES 枚）
  characterImageUrl?: string;   // A01: キャラクター画像（透過PNG推奨）
  characterName?: string;       // 中心キャラクターの表示名
  customEmotions?: CustomEmotion[]; // A03: カスタム表情パターン（最大20件）
  decorations?: SpaceDecoration[];  // A02: スペース装飾（掲示板など）
  isPrivate?: boolean;              // 非公開スペース（内省スペースなど個人利用向け）
  bubbleShapePng?: string;          // 吹き出しのカスタム形状PNGパス（例: "/assets/bubble-shapes/speech.png"）
  // T01: スペースで使えるタグ候補（管理者が登録）
  //   投稿UIのワンタップ選択候補・ログ一覧フィルタの元データとして使用。
  //   各投稿に実際についたタグは hossiis.tags（text[]）に分離して管理する。
  presetTags?: string[];
  welcomeMessage?: string;  // 入室時ウェルカムメッセージ（未設定時はデフォルト文言）
  description?: string;     // スペースの一行説明（最大50文字、未設定時は説明 UI 非表示）
  /** Tab bar folder definitions (100C). Synced via DB / local spaces cache. */
  tabFolders?: TabFolder[];
  /** マイHossii表示 ON/OFF（デフォルト false） */
  myHossiiEnabled?: boolean;
  /** マイHossiiの動き方（デフォルト auto） */
  myHossiiMotionMode?: MyHossiiMotionMode;
  /** マイHossiiログ公開範囲（デフォルト public） */
  myHossiiLogVisibility?: MyHossiiLogVisibility;
  /** 所属コミュニティ（DB: spaces.community_id） */
  communityId?: string;
  /** 共有スペースの参加モード（DB: spaces.access_mode）。personal では無視。 */
  accessMode?: 'public' | 'invite_only';
  /** 共有URLの参加方式（DB: spaces.participation_mode）。personal では無視。未設定時は guest_and_account。 */
  participationMode?: ParticipationMode;
  /** スペース種別（DB: spaces.space_type）。未取得/旧データは 'shared' 相当。 */
  spaceType?: 'shared' | 'personal';
  /**
   * 個人スペースの所有者（DB: spaces.owner_user_id = auth.users.id）。
   * personal のときのみ入る。RLS により他人の personal は取得できないため、
   * 本人の personal スペースでは currentUser.uid と一致する。
   */
  ownerUserId?: string;
  /** アーカイブ状態（DB: spaces.is_archived）。true のとき閲覧専用。 */
  isArchived?: boolean;
  archivedAt?: Date;
  archivedBy?: string;
};

/** Partial update for Space; null clears nullable DB-backed fields. */
export type SpaceUpdatePatch = Omit<Partial<Space>, 'bubbleShapePng'> & {
  bubbleShapePng?: string | null;
};

// 背景画像の保存上限
export const MAX_BACKGROUND_IMAGES = 5;

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
  quickEmotions: DEFAULT_QUICK_EMOTIONS,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  background: DEFAULT_BACKGROUND,
};

// TODO: SpaceMemberNickname は後回し
