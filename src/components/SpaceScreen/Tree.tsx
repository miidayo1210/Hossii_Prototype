import type { Hossii } from '../../core/types';
import { renderHossiiText, EMOJI_BY_EMOTION } from '../../core/utils/render';
import styles from './SpaceScreen.module.css';

/**
 * 相対時間を計算
 * - 0-59秒: 今
 * - 1-59分: xx分前
 * - 1-23時間: xx時間前
 * - それ以上: 日付
 */
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 60) return '今';
  if (diffMin < 60) return `${diffMin}分前`;
  if (diffHour < 24) return `${diffHour}時間前`;

  return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
}

type BubbleProps = {
  hossii: Hossii;
  index: number;
  position: { x: number; y: number };
  isActive: boolean;
  onActivate: () => void;
};

// バブル表示用のテキスト切り詰め
const MAX_BUBBLE_TEXT_LENGTH = 40;
function truncateText(text: string): string {
  if (text.length <= MAX_BUBBLE_TEXT_LENGTH) return text;
  return text.slice(0, MAX_BUBBLE_TEXT_LENGTH) + '…';
}

export const Bubble = ({
  hossii,
  index,
  position,
  isActive,
  onActivate,
}: BubbleProps) => {
  const displayText = renderHossiiText(hossii);

  // 笑いログかどうか
  const isLaughter = hossii.autoType === 'laughter';

  // 絵文字を取得
  // 笑いログは 😂、音声ログは 🎙、感情ログは emotion 絵文字、それ以外は 🌟
  const emoji = isLaughter
    ? '😂'
    : hossii.logType === 'speech' || hossii.autoType === 'speech'
      ? '🎙'
      : hossii.emotion
        ? EMOJI_BY_EMOTION[hossii.emotion]
        : '🌟';

  // 笑いログはテキストなし、音声ログは切り詰め
  const bubbleText = isLaughter ? '' : (hossii.logType === 'speech' || hossii.autoType === 'speech') ? truncateText(displayText) : displayText;

  // 相対時間
  const relativeTime = getRelativeTime(hossii.createdAt);

  // メタ情報（投稿者名 + 相対時間）
  const authorName = hossii.authorName;
  const metaText = authorName ? `${authorName} · ${relativeTime}` : relativeTime;

  // アニメーション遅延（バラつきを出す）
  const animationDelay = `${(index % 8) * 0.5}s`;
  const animationDuration = `${4 + (index % 3)}s`;

  return (
    <div
      className={`${styles.bubble} ${isActive ? styles.bubbleActive : ''}`}
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        animationDelay,
        animationDuration,
      }}
      onClick={onActivate}
      onMouseEnter={onActivate}
    >
      <div className={styles.bubbleInner}>
        <span className={styles.bubbleEmoji}>{emoji}</span>
        <div className={styles.bubbleContent}>
          <div className={styles.bubbleMeta}>
            <span className={styles.bubbleMetaText}>{metaText}</span>
          </div>
          {bubbleText && <p className={styles.bubbleText}>{bubbleText}</p>}
        </div>
      </div>
    </div>
  );
};

// 後方互換のため Tree も export
export const Tree = Bubble;
