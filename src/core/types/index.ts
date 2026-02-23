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

// 投稿データ
export type Hossii = {
  id: string;
  message: string;
  emotion?: EmotionKey;
  spaceId: string; // 所属するスペースのID
  authorId?: string; // 投稿者ID（端末固有、判定用）
  authorName?: string; // 投稿者名（表示用）
  createdAt: Date;
  logType?: LogType; // ログの種類（emotion / speech）- 後方互換
  speechLevel?: SpeechLevel; // 音声ログの粒度（word / short / long）
  origin?: HossiiOrigin; // 発生元（manual / auto）未設定は manual 扱い
  autoType?: AutoType; // 自動投稿の種類（emotion / speech / laughter）
  language?: LanguageCode; // 言語コード（自動生成されたログのみ）
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
};

export type Screen = 'post' | 'screen' | 'comments' | 'spaces' | 'profile' | 'mylogs' | 'account' | 'settings' | 'card';

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
