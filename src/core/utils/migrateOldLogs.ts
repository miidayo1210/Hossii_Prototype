import type { Hossii } from '../types';

// マイグレーションバージョン管理
const MIGRATION_VERSION_KEY = 'hossii.migration.version';
const CURRENT_MIGRATION_VERSION = 2; // v2: laugh pattern detection + message clear

/**
 * マイグレーションが必要かどうかをチェック
 */
export function needsMigration(): boolean {
  try {
    const storedVersion = localStorage.getItem(MIGRATION_VERSION_KEY);
    if (!storedVersion) return true;
    return parseInt(storedVersion, 10) < CURRENT_MIGRATION_VERSION;
  } catch {
    return true;
  }
}

/**
 * マイグレーション完了を記録
 */
export function markMigrationComplete(): void {
  try {
    localStorage.setItem(MIGRATION_VERSION_KEY, String(CURRENT_MIGRATION_VERSION));
  } catch {
    // ignore
  }
}

// 笑いログのメッセージパターン（過去ログ検出用）
// ※これらは useAudioListener.ts の LAUGH_MESSAGES と対応
const LAUGH_MESSAGE_PATTERNS = [
  '笑い声が聞こえた',
  'みんな笑ってる',
  '楽しそうな声',
];

/**
 * メッセージが笑いログのパターンに一致するかチェック
 * ※手入力コメントには適用しないこと（isHossiiAuthor でガード）
 */
function isLaughMessage(message: string | undefined): boolean {
  if (!message) return false;
  return LAUGH_MESSAGE_PATTERNS.some((pattern) => message.includes(pattern));
}

/**
 * 過去ログに origin/autoType を付与するマイグレーション関数
 *
 * 判定ルール（優先順位順）:
 * 1. origin が既に設定済み → スキップ
 * 2. authorName !== 'Hossii' → manual（手入力）
 * 3. authorName === 'Hossii' の場合:
 *    a. message が空 → auto:laughter
 *    b. message が笑いパターン → auto:laughter（メッセージもクリア）
 *    c. logType === 'speech' → auto:speech
 *    d. logType === 'emotion' かつ autoType !== 'laughter' → auto:emotion
 *    e. その他 → auto:emotion
 *
 * ※笑いパターン検出は Hossii 由来のログにのみ適用（手入力は巻き込まない）
 */
export function migrateHossiiOrigin(hossii: Hossii): Hossii {
  // 1. 既に origin が設定されていればスキップ
  if (hossii.origin) {
    return hossii;
  }

  const isHossiiAuthor = hossii.authorName === 'Hossii';

  // 2. 手入力コメント（Hossii 以外）は manual
  if (!isHossiiAuthor) {
    return {
      ...hossii,
      origin: 'manual',
    };
  }

  // === 以下は Hossii 由来の自動投稿のみ ===

  const hasEmptyMessage = !hossii.message || hossii.message.trim() === '';

  // 3a. 空メッセージは笑いログ
  if (hasEmptyMessage) {
    return {
      ...hossii,
      message: '',
      origin: 'auto',
      autoType: 'laughter',
    };
  }

  // 3b. 笑いパターンのメッセージも笑いログ（メッセージをクリア）
  // ※isHossiiAuthor が true の場合のみここに到達するため、手入力は巻き込まない
  if (isLaughMessage(hossii.message)) {
    return {
      ...hossii,
      message: '',
      origin: 'auto',
      autoType: 'laughter',
    };
  }

  // 3c. 音声ログ
  if (hossii.logType === 'speech') {
    return {
      ...hossii,
      origin: 'auto',
      autoType: 'speech',
    };
  }

  // 3d/3e. 感情ログ（デフォルト）
  // ガード: autoType が既に 'laughter' なら変更しない
  if (hossii.autoType === 'laughter') {
    return {
      ...hossii,
      origin: 'auto',
      // autoType はそのまま 'laughter' を維持
    };
  }

  // 感情ログとして分類
  return {
    ...hossii,
    origin: 'auto',
    autoType: 'emotion',
  };
}

/**
 * 配列に対してマイグレーションを適用
 */
export function migrateAllHossiis(hossiis: Hossii[]): Hossii[] {
  return hossiis.map(migrateHossiiOrigin);
}
