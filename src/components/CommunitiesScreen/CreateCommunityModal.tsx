import { useEffect, useId, useRef } from 'react';
import styles from './CommunitiesScreen.module.css';

const CREATE_ERROR_MESSAGE = 'コミュニティの作成に失敗しました。もう一度お試しください。';

type Props = {
  open: boolean;
  name: string;
  submitting: boolean;
  error: boolean;
  onNameChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
};

export function CreateCommunityModal({
  open,
  name,
  submitting,
  error,
  onNameChange,
  onCancel,
  onSubmit,
}: Props) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmedName = name.trim();
  const canSubmit = trimmedName.length > 0 && !submitting;

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) {
        onCancel();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, submitting, onCancel]);

  if (!open) return null;

  const handleBackdropClick = () => {
    if (!submitting) {
      onCancel();
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit();
  };

  return (
    <div
      className={styles.modalOverlay}
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        className={styles.modalCard}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className={styles.modalTitle}>
          新しいコミュニティを作成
        </h2>
        <form className={styles.modalForm} onSubmit={handleSubmit}>
          <label className={styles.modalLabel} htmlFor={`${titleId}-name`}>
            コミュニティ名
          </label>
          <input
            ref={inputRef}
            id={`${titleId}-name`}
            type="text"
            className={styles.modalInput}
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            disabled={submitting}
            autoComplete="off"
            maxLength={120}
          />
          {error && (
            <p className={styles.modalError} role="alert">
              {CREATE_ERROR_MESSAGE}
            </p>
          )}
          <div className={styles.modalActions}>
            <button
              type="button"
              className={styles.modalCancelButton}
              onClick={onCancel}
              disabled={submitting}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className={styles.modalSubmitButton}
              disabled={!canSubmit}
            >
              {submitting ? '作成中...' : '作成する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
