import type { Hossii } from '../../core/types';
import styles from './PinTray.module.css';

type Props = {
  pinnedHossiis: Hossii[];
  onHighlight: (id: string) => void;
  onUnpin: (id: string) => void;
};

function formatCardLabel(hossii: Hossii): string {
  const author = hossii.authorName?.trim() || '—';
  const text = hossii.message?.trim();
  if (text) return `${author}「${text}」`;
  if (hossii.imageUrl) return `${author}（画像）`;
  return author;
}

export function PinTray({ pinnedHossiis, onHighlight, onUnpin }: Props) {
  if (pinnedHossiis.length === 0) return null;

  return (
    <div className={styles.tray} data-space-export="exclude">
      {pinnedHossiis.map((hossii) => (
        <div
          key={hossii.id}
          className={styles.card}
          role="button"
          tabIndex={0}
          onClick={() => onHighlight(hossii.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onHighlight(hossii.id);
            }
          }}
        >
          <span className={styles.pinIcon} aria-hidden="true">
            📌
          </span>
          <span className={styles.label}>{formatCardLabel(hossii)}</span>
          <button
            type="button"
            className={styles.unpin}
            aria-label="ピン留めを解除する"
            onClick={(e) => {
              e.stopPropagation();
              onUnpin(hossii.id);
            }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
