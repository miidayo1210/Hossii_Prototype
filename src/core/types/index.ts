// 気持ちの種類（8種）
export type EmotionKey =
  | 'wow'
  | 'empathy'
  | 'inspire'
  | 'think'
  | 'laugh'
  | 'joy'
  | 'moved'
  | 'fun';

// ログの種類（後方互換のため残す）
export type LogType = 'emotion' | 'speech';

// 投稿の発生元
export type HossiiOrigin = 'manual' | 'auto';

// 自動投稿の種類
export type AutoType = 'emotion' | 'speech' | 'laughter';

// 音声ログの粒度
export type SpeechLevel = 'word' | 'short' | 'long';

// 言語コード
export type LanguageCode = 'ja' | 'en' | 'unknown';

/** 投稿の表示種別（吹き出し / キャンバス画像） */
export type HossiiPostKind = 'bubble' | 'canvas';

/**
 * 投稿の公開範囲（Phase 2D-1）
 * - public: 通常投稿（従来どおり）
 * - owner_only: 投稿したログイン本人だけが取得・表示できる（管理者の非表示とは別概念）
 */
export type HossiiVisibility = 'public' | 'owner_only';

// 投稿データ
export type Hossii = {
  id: string;
  message: string;
  emotion?: EmotionKey;
  spaceId: string; // 所属するスペースのID
  /** 所属 Pane ID。NULL/未設定 = レガシー投稿（default Pane 扱い） */
  spacePaneId?: string | null;
  authorId?: string; // 投稿者ID（端末固有、判定用）
  authorName?: string; // 投稿者名（表示用）
  createdAt: Date;
  logType?: LogType; // ログの種類（emotion / speech）- 後方互換
  speechLevel?: SpeechLevel; // 音声ログの粒度（word / short / long）
  origin?: HossiiOrigin; // 発生元（manual / auto）未設定は manual 扱い
  autoType?: AutoType; // 自動投稿の種類（emotion / speech / laughter）
  language?: LanguageCode; // 言語コード（自動生成されたログのみ）
  // F01: 吹き出し色
  bubbleColor?: string;
  // B02: 吹き出し形状（投稿ごと）
  bubbleShapePng?: string;
  // F09: ハッシュタグ（自由入力）
  hashtags?: string[];
  // T02: 投稿タグ（プリセットから選択）
  //   スペースの preset_tags から選択して付与するタグ。
  //   保存先は hossiis テーブルの tags カラム（text[]。hashtags と同型）。
  //   投稿 INSERT での永続化は別タスク。
  tags?: string[];
  // F10: 画像投稿
  imageUrl?: string;
  // F02/F04: 吹き出し座標固定
  positionX?: number;
  positionY?: number;
  isPositionFixed?: boolean;
  // F05: 吹き出しスケール
  scale?: number;
  // F06: 非表示（管理者）
  isHidden?: boolean;
  hiddenAt?: Date;
  hiddenBy?: string; // 管理者の userId
  // numberPost: 数値投稿
  numberValue?: number;
  // いいね機能（SpaceSettings.features.likesEnabled が ON の場合のみ使用）
  likeCount?: number;
  likedByMe?: boolean; // クライアント側ローカル状態（Supabase には保存しない）
  /** 未設定・bubble = 従来の吹き出し。canvas = フリー投稿（可変比率のラスタ PNG） */
  postKind?: HossiiPostKind;
  // Phase 2D-1: 本人による公開範囲 / ソフト削除 / 本文編集
  /** 公開範囲。未設定は 'public' 扱い */
  visibility?: HossiiVisibility;
  /** ソフト削除日時。null/未設定 = 未削除 */
  deletedAt?: Date | null;
  /** 本文編集日時。null/未設定 = 未編集（visibility 変更やモデレーションでは更新されない） */
  contentEditedAt?: Date | null;
};

// addHossii の入力型（message は空もあり得るが、最終的に空投稿は弾く）
export type AddHossiiInput = {
  message?: string;
  emotion?: EmotionKey;
  authorNameOverride?: string; // Listen モードなどで authorName を上書きする場合
  logType?: LogType; // ログの種類（後方互換）
  speechLevel?: SpeechLevel; // 音声ログの粒度
  origin?: HossiiOrigin; // 発生元
  autoType?: AutoType; // 自動投稿の種類
  language?: LanguageCode; // 言語コード
  bubbleColor?: string; // F01
  bubbleShapePng?: string; // B02
  hashtags?: string[]; // F09
  tags?: string[]; // T02: プリセットタグ
  imageUrl?: string; // F10
  numberValue?: number; // numberPost
  positionX?: number; // 0〜1 の相対座標
  positionY?: number; // 0〜1 の相対座標
  isPositionFixed?: boolean; // true のとき上記座標で固定配置
  postKind?: HossiiPostKind;
  /** canvas 投稿時の初期スケール（省略時はストア側デフォルト） */
  scale?: number;
  /** 共有スペース上の「わたし」タブ表示時など、表示 shell と異なる投稿先 */
  postSpaceId?: string;
  postPaneId?: string;
};

export type Screen = 'post' | 'screen' | 'comments' | 'spaces' | 'profile' | 'mylogs' | 'account' | 'settings' | 'card' | 'communities' | 'reflection' | 'neighbors' | 'community' | 'community-invite';

export type HossiiState = {
  hossiis: Hossii[];
  selectedHossiiId: string | null;
};

export type HossiiAction =
  | { type: 'ADD_HOSSII'; payload: AddHossiiInput }
  | { type: 'SELECT_HOSSII'; payload: string | null }
  | { type: 'CLEAR_ALL' };

// Toast の状態型（共通）
export type ToastState = {
  message: string;
  type: 'success' | 'error';
};

// ユーザープロフィール
export type UserProfile = {
  uid: string; // Firebase Auth UID
  userId: string; // ユーザーID（一意、英数字）
  nickname: string; // ニックネーム（表示名）
  email: string; // メールアドレス
  createdAt: Date; // 登録日時
  updatedAt: Date; // 更新日時
};
