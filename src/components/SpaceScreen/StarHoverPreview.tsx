import { createPortal } from 'react-dom';
import type { Hossii } from '../../core/types';
import { EMOJI_BY_EMOTION } from '../../core/assets/emotions';
import { PinButton } from './PinButton';
import styles from './StarHoverPreview.module.css';

type Props = {
  hossii: Hossii;
  anchorRect: DOMRect;
  isPinned?: boolean;
  onPinToggle?: (id: string) => void;
  showPinUi?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

const GAP = 12;
const MAX_W = 300;
const MAX_TEXT = 80;

export function StarHoverPreview({
  hossii,
  anchorRect,
  isPinned = false,
  onPinToggle,
  showPinUi = false,
  onMouseEnter,
  onMouseLeave,
}: Props) {
  const centerX = anchorRect.left + anchorRect.width / 2;
  let left = centerX - MAX_W / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - MAX_W - 8));

  const bottom = window.innerHeight - anchorRect.top + GAP;

  const rawMessage = hossii.message?.trim();
  const message = rawMessage
    ? rawMessage.slice(0, MAX_TEXT) + (rawMessage.length > MAX_TEXT ? '…' : '')
    : null;
  const author = hossii.authorName?.trim() || '—';
  const emotionEmoji = hossii.emotion ? EMOJI_BY_EMOTION[hossii.emotion] : null;

  return createPortal(
    <div
      className={styles.card}
      style={{ left, bottom, width: MAX_W }}
      role="tooltip"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {showPinUi && onPinToggle && (
        <PinButton
          className={styles.pinButton}
          isPinned={isPinned}
          visible
          onToggle={() => onPinToggle(hossii.id)}
        />
      )}
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
