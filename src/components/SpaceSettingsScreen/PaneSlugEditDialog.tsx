import { useCallback, useEffect, useState } from 'react';
import type { SpacePane } from '../../core/types/spacePane';
import { updateSpacePane, uniquePaneSlug } from '../../core/utils/spacePanesApi';
import { validatePaneSlug } from '../../core/utils/spacePaneManagement';
import styles from './PaneSlugEditDialog.module.css';

type Props = {
  open: boolean;
  pane: SpacePane | null;
  existingPanes: SpacePane[];
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
};

export function PaneSlugEditDialog({
  open,
  pane,
  existingPanes,
  onClose,
  onSaved,
  onError,
}: Props) {
  const [slug, setSlug] = useState('');
  const [slugError, setSlugError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && pane) {
      setSlug(pane.slug);
      setSlugError(null);
      setSubmitting(false);
    }
  }, [open, pane]);

  const handleSubmit = useCallback(async () => {
    if (!pane) return;

    const trimmed = slug.trim().toLowerCase();
    const validation = validatePaneSlug(trimmed, existingPanes, pane.id);
    if (validation) {
      setSlugError(validation);
      return;
    }

    if (trimmed === pane.slug.toLowerCase()) {
      onClose();
      return;
    }

    const confirmed = window.confirm(
      'slug を変更すると、このタブ専用の URL と QR コードが無効になります。続行しますか？',
    );
    if (!confirmed) return;

    setSlugError(null);
    setSubmitting(true);

    try {
      const normalized = uniquePaneSlug(
        trimmed,
        existingPanes.filter((p) => p.id !== pane.id).map((p) => p.slug),
      );

      const updated = await updateSpacePane(pane.id, { slug: normalized });
      if (!updated) {
        onError('slug の更新に失敗しました');
        return;
      }

      onSaved();
      onClose();
    } catch {
      onError('slug の更新に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }, [slug, pane, existingPanes, onClose, onSaved, onError]);

  if (!open || !pane) return null;

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={() => {
        if (!submitting) onClose();
      }}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pane-slug-edit-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="pane-slug-edit-title" className={styles.title}>
          slug を変更
        </h2>
        <p className={styles.warning}>
          変更すると既存の Pane URL と QR コードは使えなくなります。ブックマークや共有リンクの更新が必要です。
        </p>
        <p className={styles.hint}>
          タブ: {pane.name} — 半角英小文字・数字・ハイフンのみ
        </p>
        <input
          type="text"
          className={`${styles.input}${slugError ? ` ${styles.inputError}` : ''}`}
          value={slug}
          maxLength={40}
          autoFocus
          disabled={submitting}
          onChange={(e) => {
            setSlug(e.target.value);
            if (slugError) setSlugError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSubmit();
            if (e.key === 'Escape' && !submitting) onClose();
          }}
        />
        {slugError && <p className={styles.errorText}>{slugError}</p>}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelButton}
            disabled={submitting}
            onClick={onClose}
          >
            キャンセル
          </button>
          <button
            type="button"
            className={styles.submitButton}
            disabled={submitting || !slug.trim()}
            onClick={() => void handleSubmit()}
          >
            {submitting ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
