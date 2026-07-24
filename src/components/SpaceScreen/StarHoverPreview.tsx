import { createPortal } from 'react-dom';
import type { Hossii } from '../../core/types';
import { EMOJI_BY_EMOTION } from '../../core/assets/emotions';
import { getHossiiBubbleFullText } from '../../core/utils/bubbleTextTruncation';
import { PinButton } from './PinButton';
import { HossiiDisplayTagRow } from './HossiiDisplayTagRow';
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
const MAX_W = 380;

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
  const width = Math.min(MAX_W, window.innerWidth * 0.34);
  let left = centerX - width / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - width - 8));

  const bottom = window.innerHeight - anchorRect.top + GAP;

  const message = getHossiiBubbleFullText(hossii) || null;
  const author = hossii.authorName?.trim() || '—';
  const emotionEmoji = hossii.emotion ? EMOJI_BY_EMOTION[hossii.emotion] : null;

  return createPortal(
    <div
      className={styles.card}
      style={{ left, bottom, width }}
      role="tooltip"
      aria-label="投稿全文"
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
      <HossiiDisplayTagRow
        tags={hossii.tags}
        hashtags={hossii.hashtags}
        className={styles.previewTags}
        tagClassName={styles.previewTag}
        presetClassName={styles.previewTagPreset}
        freeClassName={styles.previewTagFree}
        moreClassName={styles.previewTagMore}
      />
    </div>,
    document.body,
  );
}
