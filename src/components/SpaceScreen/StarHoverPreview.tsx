import { createPortal } from 'react-dom';
import type { Hossii } from '../../core/types';
import { PinButton } from './PinButton';
import styles from './StarHoverPreview.module.css';

type Props = {
  hossii: Hossii;
  anchorRect: DOMRect;
  isPinned?: boolean;
  onPinToggle?: (id: string) => void;
  showPinUi?: boolean;
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

  return createPortal(
    <div
      className={styles.card}
      style={{ left, bottom, width: MAX_W }}
      role="tooltip"
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
      <span className={styles.author}>{author}</span>
    </div>,
    document.body,
  );
}
