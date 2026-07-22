import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';
import styles from './ConnectionEditorPopover.module.css';

const GAP = 10;
const WIDTH = 220;

function clampHorizontal(left: number, width: number): number {
  return Math.max(8, Math.min(left, window.innerWidth - width - 8));
}

type Props = {
  anchorRect: DOMRect;
  onConfirm: () => void;
  onCancel: () => void;
  disabled?: boolean;
  errorMessage?: string | null;
};

export function ConnectionDeleteConfirmPopover({
  anchorRect,
  onConfirm,
  onCancel,
  disabled = false,
  errorMessage = null,
}: Props) {
  const centerX = anchorRect.left + anchorRect.width / 2;
  const left = clampHorizontal(centerX - WIDTH / 2, WIDTH);
  const style: CSSProperties = {
    position: 'fixed',
    left,
    width: WIDTH,
    bottom: window.innerHeight - anchorRect.top + GAP,
    zIndex: 330,
  };

  return createPortal(
    <div
      className={`${styles.popover} hossii-pop`}
      style={style}
      data-connection-editor-popover
      data-space-export="exclude"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      role="alertdialog"
      aria-labelledby="connection-delete-title"
      aria-describedby="connection-delete-description"
    >
      <p id="connection-delete-title" className={styles.title}>
        糸をほどく
      </p>
      <p id="connection-delete-description" className={styles.confirmText}>
        このつながりをほどきます。よろしいですか？
      </p>
      {errorMessage && (
        <p className={styles.error} role="alert">
          {errorMessage}
        </p>
      )}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={onCancel}
          disabled={disabled}
        >
          やめる
        </button>
        <button
          type="button"
          className={styles.dangerButton}
          onClick={onConfirm}
          disabled={disabled}
        >
          ほどく
        </button>
      </div>
    </div>,
    document.body,
  );
}
