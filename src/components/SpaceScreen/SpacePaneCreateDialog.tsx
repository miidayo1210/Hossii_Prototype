import { useCallback, useEffect, useState } from 'react';
import type { SpacePane } from '../../core/types/spacePane';
import { generateId } from '../../core/utils';
import {
  createSpacePane,
  generatePaneSlugFromName,
  uniquePaneSlug,
} from '../../core/utils/spacePanesApi';
import styles from './SpacePaneCreateDialog.module.css';

const MAX_NAME_LEN = 30;

type Props = {
  open: boolean;
  spaceId: string;
  existingPanes: SpacePane[];
  onClose: () => void;
  onCreated: (pane: SpacePane) => void;
  onError: (message: string) => void;
};

export function SpacePaneCreateDialog({
  open,
  spaceId,
  existingPanes,
  onClose,
  onCreated,
  onError,
}: Props) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setName('');
      setNameError(null);
      setSubmitting(false);
    }
  }, [open]);

  const handleSubmit = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('タブ名を入力してください');
      return;
    }
    if (trimmed.length > MAX_NAME_LEN) {
      setNameError(`${MAX_NAME_LEN}文字以内で入力してください`);
      return;
    }

    setNameError(null);
    setSubmitting(true);

    const newId = generateId();
    const baseSlug = generatePaneSlugFromName(trimmed, newId);
    const slug = uniquePaneSlug(
      baseSlug,
      existingPanes.map((p) => p.slug),
    );
    const maxSort = existingPanes.reduce(
      (max, p) => Math.max(max, p.sortOrder),
      -1,
    );

    try {
      const created = await createSpacePane({
        id: newId,
        spaceId,
        name: trimmed,
        slug,
        sortOrder: maxSort + 1,
        isDefault: false,
        isVisible: true,
      });

      if (!created) {
        onError('タブの作成に失敗しました。件数上限または権限を確認してください');
        return;
      }

      onCreated(created);
      onClose();
    } catch {
      onError('タブの作成に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }, [name, spaceId, existingPanes, onClose, onCreated, onError]);

  if (!open) return null;

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
        aria-labelledby="space-pane-create-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="space-pane-create-title" className={styles.title}>
          タブを追加
        </h2>
        <p className={styles.hint}>
          新しいタブにはスペース共通の背景・設定が使われます。名称は最大 {MAX_NAME_LEN} 文字です。
        </p>
        <input
          type="text"
          className={`${styles.input}${nameError ? ` ${styles.inputError}` : ''}`}
          value={name}
          maxLength={MAX_NAME_LEN}
          placeholder="例: 今日の問い"
          autoFocus
          disabled={submitting}
          onChange={(e) => {
            setName(e.target.value);
            if (nameError) setNameError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSubmit();
            if (e.key === 'Escape' && !submitting) onClose();
          }}
        />
        {nameError && <p className={styles.errorText}>{nameError}</p>}
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
            disabled={submitting || !name.trim()}
            onClick={() => void handleSubmit()}
          >
            {submitting ? '作成中…' : '作成'}
          </button>
        </div>
      </div>
    </div>
  );
}
