import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalPortalRoot } from '../../core/hooks/useModalPortalRoot';
import type { SpacePane } from '../../core/types/spacePane';
import { generateId } from '../../core/utils';
import {
  createSpacePane,
  generatePaneSlugFromName,
  uniquePaneSlug,
} from '../../core/utils/spacePanesApi';
import {
  MAX_PANE_NAME_LEN,
  canCreatePane,
  paneLimitMessage,
  validatePaneName,
} from '../../core/utils/spacePaneManagement';
import styles from './SpacePaneCreateDialog.module.css';

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
  const openedAtRef = useRef(0);
  const portalRoot = useModalPortalRoot();

  useEffect(() => {
    if (!open) {
      setName('');
      setNameError(null);
      setSubmitting(false);
    }
  }, [open]);

  useLayoutEffect(() => {
    if (open) {
      openedAtRef.current = Date.now();
    }
  }, [open]);

  const handleSubmit = useCallback(async () => {
    if (!canCreatePane(existingPanes.length)) {
      onError(paneLimitMessage());
      return;
    }

    const trimmed = name.trim();
    const validation = validatePaneName(trimmed);
    if (validation) {
      setNameError(validation);
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
      const result = await createSpacePane({
        id: newId,
        spaceId,
        name: trimmed,
        slug,
        sortOrder: maxSort + 1,
        isDefault: false,
        isVisible: true,
      });

      if (!result.ok) {
        onError(result.error);
        return;
      }

      onCreated(result.pane);
      onClose();
    } catch {
      onError('タブの作成に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }, [name, spaceId, existingPanes, onClose, onCreated, onError]);

  if (!open) return null;

  const dialog = (
    <div
      className={styles.overlay}
      data-space-pane-dialog
      role="presentation"
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        if (Date.now() - openedAtRef.current < 400) return;
        if (!submitting) onClose();
      }}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="space-pane-create-title"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="space-pane-create-title" className={styles.title}>
          タブを追加
        </h2>
        <p className={styles.hint}>
          新しいタブにはスペース共通の背景・設定が使われます。名称は最大 {MAX_PANE_NAME_LEN} 文字です。
        </p>
        <input
          type="text"
          className={`${styles.input}${nameError ? ` ${styles.inputError}` : ''}`}
          value={name}
          maxLength={MAX_PANE_NAME_LEN}
          placeholder="例: 今日の問い"
          autoFocus
          disabled={submitting}
          onChange={(e) => {
            setName(e.target.value);
            if (nameError) setNameError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return;
              e.preventDefault();
              void handleSubmit();
            }
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

  return createPortal(dialog, portalRoot);
}
