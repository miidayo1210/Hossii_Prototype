import { createPortal } from 'react-dom';
import type { Hossii } from '../../core/types';
import styles from './StarHoverPreview.module.css';

type Props = {
  hossii: Hossii;
  anchorRect: DOMRect;
  previewSide: 'left' | 'right';
};

export function StarHoverPreview({ hossii, anchorRect, previewSide }: Props) {
  const gap = 8;
  const maxW = 220;
  let left =
    previewSide === 'right'
      ? anchorRect.right + gap
      : anchorRect.left - gap - maxW;
  left = Math.max(8, Math.min(left, window.innerWidth - maxW - 8));
  const top = Math.max(8, Math.min(anchorRect.top, window.innerHeight - 120));

  const message = hossii.message?.trim();
  const author = hossii.authorName?.trim() || '—';

  return createPortal(
    <div
      className={styles.card}
      style={{ left, top, maxWidth: maxW }}
      role="tooltip"
    >
      {hossii.imageUrl && (
        <img src={hossii.imageUrl} alt="" className={styles.thumb} />
      )}
      {message && <p className={styles.message}>{message}</p>}
      <span className={styles.author}>{author}</span>
    </div>,
    document.body,
  );
}
