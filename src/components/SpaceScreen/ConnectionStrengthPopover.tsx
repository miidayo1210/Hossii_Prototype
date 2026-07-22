import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';
import type { HossiiConnectionStrength } from '../../core/types/hossiiConnection';
import { HOSSII_CONNECTION_STRENGTH_LABELS } from '../../core/utils/hossiiConnectionStrengthLabels';
import styles from './ConnectionEditorPopover.module.css';

const GAP = 10;
const WIDTH = 220;

function clampHorizontal(left: number, width: number): number {
  return Math.max(8, Math.min(left, window.innerWidth - width - 8));
}

type Props = {
  anchorRect: DOMRect;
  mode: 'create' | 'edit';
  selectedStrength: HossiiConnectionStrength | null;
  onSelectStrength: (strength: HossiiConnectionStrength) => void;
  onPrimaryAction: () => void;
  onRequestDelete?: () => void;
  onCancel: () => void;
  disabled?: boolean;
  errorMessage?: string | null;
};

export function ConnectionStrengthPopover({
  anchorRect,
  mode,
  selectedStrength,
  onSelectStrength,
  onPrimaryAction,
  onRequestDelete,
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

  const primaryLabel = mode === 'create' ? 'つなぐ' : '強さ変更';

  return createPortal(
    <div
      className={`${styles.popover} hossii-pop`}
      style={style}
      data-connection-editor-popover
      data-space-export="exclude"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <p className={styles.title}>
        {mode === 'create' ? 'つなぐ強さを選ぶ' : '強さを変える'}
      </p>
      <div className={styles.strengthList}>
        {HOSSII_CONNECTION_STRENGTH_LABELS.map((entry) => {
          const active = selectedStrength === entry.value;
          return (
            <button
              key={entry.value}
              type="button"
              className={`${styles.strengthOption} ${active ? styles.strengthOptionActive : ''}`}
              onClick={() => onSelectStrength(entry.value)}
              disabled={disabled}
              aria-pressed={active}
            >
              <span className={styles.strengthLabel}>{entry.title}</span>
              <span className={styles.strengthDescription}>{entry.description}</span>
            </button>
          );
        })}
      </div>
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
        {mode === 'edit' && onRequestDelete && (
          <button
            type="button"
            className={styles.dangerButton}
            onClick={onRequestDelete}
            disabled={disabled}
          >
            ほどく
          </button>
        )}
        <button
          type="button"
          className={styles.primaryButton}
          onClick={onPrimaryAction}
          disabled={disabled || selectedStrength == null}
        >
          {primaryLabel}
        </button>
      </div>
    </div>,
    document.body,
  );
}
