import { createPortal } from 'react-dom';
import type { CSSProperties, ChangeEvent } from 'react';
import type {
  HossiiConnectionReasonEmoji,
  HossiiConnectionStrength,
} from '../../core/types/hossiiConnection';
import { HOSSII_CONNECTION_REASON_EMOJIS } from '../../core/types/hossiiConnection';
import { MAX_CONNECTION_REASON_TEXT_LENGTH } from '../../core/utils/connectionReasonValidation';
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
  reasonExpanded: boolean;
  draftReasonText: string;
  draftReasonEmoji: HossiiConnectionReasonEmoji | null;
  onSelectStrength: (strength: HossiiConnectionStrength) => void;
  onToggleReasonExpanded: () => void;
  onDraftReasonTextChange: (text: string) => void;
  onToggleDraftReasonEmoji: (emoji: HossiiConnectionReasonEmoji) => void;
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
  reasonExpanded,
  draftReasonText,
  draftReasonEmoji,
  onSelectStrength,
  onToggleReasonExpanded,
  onDraftReasonTextChange,
  onToggleDraftReasonEmoji,
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

  const primaryLabel = mode === 'create' ? 'つなぐ' : '保存する';
  const reasonCharCount = draftReasonText.length;

  const handleReasonTextChange = (event: ChangeEvent<HTMLInputElement>) => {
    onDraftReasonTextChange(event.target.value);
  };

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
        {mode === 'create' ? 'つなぐ強さを選ぶ' : 'つながりを編集'}
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
      <div className={styles.reasonSection}>
        {!reasonExpanded ? (
          <button
            type="button"
            className={styles.reasonToggle}
            onClick={onToggleReasonExpanded}
            disabled={disabled}
          >
            ＋ 理由も添える
          </button>
        ) : (
          <div className={styles.reasonPanel}>
            <div className={styles.reasonEmojiRow}>
              {HOSSII_CONNECTION_REASON_EMOJIS.map((emoji) => {
                const active = draftReasonEmoji === emoji;
                return (
                  <button
                    key={emoji}
                    type="button"
                    className={`${styles.reasonEmojiButton} ${active ? styles.reasonEmojiButtonActive : ''}`}
                    onClick={() => onToggleDraftReasonEmoji(emoji)}
                    disabled={disabled}
                    aria-pressed={active}
                    aria-label={`理由の絵文字 ${emoji}`}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              className={styles.reasonInput}
              value={draftReasonText}
              onChange={handleReasonTextChange}
              disabled={disabled}
              placeholder="理由（任意）"
              maxLength={MAX_CONNECTION_REASON_TEXT_LENGTH}
              aria-label="つながりの理由"
            />
            <p className={styles.reasonCounter} aria-live="polite">
              {reasonCharCount}/{MAX_CONNECTION_REASON_TEXT_LENGTH}
            </p>
          </div>
        )}
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
