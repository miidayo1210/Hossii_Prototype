import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';
import type { Hossii } from '../../core/types';
import { EMOJI_BY_EMOTION } from '../../core/assets/emotions';
import { getHossiiBubbleFullText } from '../../core/utils/bubbleTextTruncation';
import styles from './HossiiFullTextPopover.module.css';

export type FullTextPopoverVariant = 'bubble' | 'star';

type Props = {
  hossii: Hossii;
  anchorRect: DOMRect;
  variant?: FullTextPopoverVariant;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

const WIDTH: Record<FullTextPopoverVariant, number> = {
  bubble: 360,
  star: 380,
};

const GAP = 12;

function clampHorizontal(left: number, width: number): number {
  return Math.max(8, Math.min(left, window.innerWidth - width - 8));
}

export function HossiiFullTextPopover({
  hossii,
  anchorRect,
  variant = 'bubble',
  onMouseEnter,
  onMouseLeave,
}: Props) {
  const width = Math.min(
    WIDTH[variant],
    variant === 'bubble' ? window.innerWidth * 0.32 : window.innerWidth * 0.34,
  );
  const centerX = anchorRect.left + anchorRect.width / 2;
  const left = clampHorizontal(centerX - width / 2, width);

  const spaceAbove = anchorRect.top;
  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const preferAbove = spaceAbove >= spaceBelow;
  const style: CSSProperties = preferAbove
    ? { left, width, bottom: window.innerHeight - anchorRect.top + GAP }
    : { left, width, top: anchorRect.bottom + GAP };

  const message = getHossiiBubbleFullText(hossii);
  const author = hossii.authorName?.trim() || '—';
  const emotionEmoji = hossii.emotion ? EMOJI_BY_EMOTION[hossii.emotion] : null;

  return createPortal(
    <div
      className={`${styles.card} ${preferAbove ? styles.cardAbove : styles.cardBelow}`}
      style={style}
      role="tooltip"
      aria-label="投稿全文"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {hossii.imageUrl && (
        <img src={hossii.imageUrl} alt="" className={styles.thumb} />
      )}
      {message && <p className={styles.message}>{message}</p>}
      <span className={styles.authorLine}>
        {emotionEmoji && (
          <span className={styles.authorEmotion} aria-hidden="true">
            {emotionEmoji}
          </span>
        )}
        <span className={styles.author}>{author}</span>
      </span>
    </div>,
    document.body,
  );
}
