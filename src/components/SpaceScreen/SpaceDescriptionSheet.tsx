import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import styles from './SpaceDescriptionSheet.module.css';

type Props = {
  open: boolean;
  onClose: () => void;
  description: string;
};

export function SpaceDescriptionSheet({ open, onClose, description }: Props) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className={styles.overlay}
      onClick={onClose}
      data-space-export="exclude"
      role="dialog"
      aria-modal="true"
      aria-labelledby="space-description-title"
    >
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <h2 id="space-description-title" className={styles.title}>
            このスペースについて
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="閉じる"
          >
            <X size={16} />
          </button>
        </header>
        <p className={styles.body}>{description}</p>
      </div>
    </div>,
    document.body,
  );
}
