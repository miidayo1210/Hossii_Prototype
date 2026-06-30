import { useCallback, useEffect, useState, type MouseEvent } from 'react';
import styles from './NewHossiiToast.module.css';
import { formatHossiiPreview, type NewHossiiPayload } from './types';

export type NewHossiiToastProps = {
  hossii: NewHossiiPayload | null;
  show: boolean;
  onClose: () => void;
  /** トースト本体クリック時（例: 該当 Hossii へスクロール） */
  onView?: (hossii: NewHossiiPayload) => void;
  /** 表示時間（ms）。デフォルト 4200ms */
  duration?: number;
};

export function NewHossiiToast({
  hossii,
  show,
  onClose,
  onView,
  duration = 4200,
}: NewHossiiToastProps) {
  const [phase, setPhase] = useState<'hidden' | 'entering' | 'visible' | 'exiting'>('hidden');

  const dismiss = useCallback(() => {
    setPhase('exiting');
    window.setTimeout(onClose, 200);
  }, [onClose]);

  useEffect(() => {
    if (!show || !hossii) {
      setPhase('hidden');
      return;
    }

    setPhase('entering');
    const enterTimer = window.setTimeout(() => setPhase('visible'), 16);
    const exitTimer = window.setTimeout(() => dismiss(), duration);

    return () => {
      window.clearTimeout(enterTimer);
      window.clearTimeout(exitTimer);
    };
  }, [show, hossii, duration, dismiss]);

  if (!show || !hossii || phase === 'hidden') return null;

  const preview = formatHossiiPreview(hossii);
  const authorLabel = hossii.authorName?.trim() || 'だれか';
  const isAnimatingIn = phase === 'entering' || phase === 'visible';

  const handleToastClick = () => {
    onView?.(hossii);
    dismiss();
  };

  const handleDismissClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    dismiss();
  };

  return (
    <div
      className={[
        styles.container,
        isAnimatingIn ? styles.visible : '',
        phase === 'exiting' ? styles.exiting : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        className={[styles.toast, phase === 'entering' ? styles.hossiiPop : '']
          .filter(Boolean)
          .join(' ')}
        onClick={handleToastClick}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleToastClick();
          }
        }}
        tabIndex={0}
      >
        <div className={styles.avatar} aria-hidden="true">
          <span className={styles.avatarGlyph}>🌟</span>
          <span className={styles.sparkle}>✨</span>
        </div>

        <div className={styles.body}>
          <span className={styles.eyebrow}>新しい Hossii が届きました</span>
          <p className={styles.preview}>{preview}</p>
          <span className={styles.meta}>{authorLabel} の気持ち</span>
        </div>

        <button
          type="button"
          className={styles.dismiss}
          aria-label="閉じる"
          onClick={handleDismissClick}
        >
          ×
        </button>
      </div>
    </div>
  );
}
