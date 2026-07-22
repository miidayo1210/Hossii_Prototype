import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { UseConnectionEditorReturn } from './useConnectionEditor';
import { ConnectionStrengthPopover } from './ConnectionStrengthPopover';
import { ConnectionDeleteConfirmPopover } from './ConnectionDeleteConfirmPopover';
import styles from './ConnectionEditorPopover.module.css';
import { escapeDataAttributeSelectorValue } from '../../core/utils/escapeDataAttributeSelectorValue';

function PickTargetErrorNotice({
  anchorRect,
  message,
}: {
  anchorRect: DOMRect;
  message: string;
}) {
  const centerX = anchorRect.left + anchorRect.width / 2;
  const left = Math.max(8, Math.min(centerX - 110, window.innerWidth - 228));
  return createPortal(
    <div
      className={styles.popover}
      style={{
        position: 'fixed',
        left,
        width: 220,
        bottom: window.innerHeight - anchorRect.top + 10,
        zIndex: 330,
      }}
      data-connection-editor-popover
      data-space-export="exclude"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <p className={styles.error} role="alert">
        {message}
      </p>
    </div>,
    document.body,
  );
}

function useHossiiAnchorRect(hossiiId: string | null, active: boolean): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    if (!active || !hossiiId) {
      queueMicrotask(() => setRect(null));
      return;
    }

    const el = document.querySelector(
      `[data-hossii-id="${escapeDataAttributeSelectorValue(hossiiId)}"]`,
    );
    queueMicrotask(() => {
      setRect(el ? el.getBoundingClientRect() : null);
    });
  }, [active, hossiiId]);

  return rect;
}

type Props = {
  editor: UseConnectionEditorReturn;
  selectedBubbleId: string | null;
  canWriteConnections: boolean;
  isConnectionsContextEnabled: boolean;
};

export function ConnectionEditorPortals({
  editor,
  selectedBubbleId,
  canWriteConnections,
  isConnectionsContextEnabled,
}: Props) {
  const {
    phase,
    targetId,
    sourceId,
    editingConnection,
    selectedStrength,
    errorMessage,
    isSaving,
    chooseStrength,
    submitCreate,
    submitStrengthUpdate,
    requestDelete,
    confirmDelete,
    cancel,
  } = editor;

  const editorPortalEnabled = canWriteConnections && isConnectionsContextEnabled;

  const strengthPopoverActive =
    phase === 'pickingStrength' ||
    phase === 'editing' ||
    phase === 'error' ||
    phase === 'saving';
  const strengthAnchorId =
    phase === 'pickingStrength' ? targetId : selectedBubbleId;
  const strengthAnchorRect = useHossiiAnchorRect(
    strengthAnchorId,
    editorPortalEnabled && strengthPopoverActive,
  );

  const deleteAnchorRect = useHossiiAnchorRect(
    selectedBubbleId,
    editorPortalEnabled && phase === 'deleting',
  );

  const pickTargetErrorRect = useHossiiAnchorRect(
    sourceId,
    editorPortalEnabled && phase === 'pickingTarget' && !!errorMessage,
  );

  if (!editorPortalEnabled) return null;

  const strengthMode =
    phase === 'pickingStrength' || (phase === 'error' && !editingConnection)
      ? 'create'
      : 'edit';

  return (
    <>
      {phase === 'pickingTarget' && errorMessage && pickTargetErrorRect && (
        <PickTargetErrorNotice anchorRect={pickTargetErrorRect} message={errorMessage} />
      )}
      {strengthPopoverActive && strengthAnchorRect && (
        <ConnectionStrengthPopover
          anchorRect={strengthAnchorRect}
          mode={strengthMode}
          selectedStrength={selectedStrength}
          onSelectStrength={chooseStrength}
          onPrimaryAction={
            strengthMode === 'create' ? submitCreate : submitStrengthUpdate
          }
          onRequestDelete={strengthMode === 'edit' ? requestDelete : undefined}
          onCancel={cancel}
          disabled={isSaving}
          errorMessage={errorMessage}
        />
      )}
      {phase === 'deleting' && deleteAnchorRect && (
        <ConnectionDeleteConfirmPopover
          anchorRect={deleteAnchorRect}
          onConfirm={confirmDelete}
          onCancel={cancel}
          disabled={isSaving}
          errorMessage={errorMessage}
        />
      )}
    </>
  );
}
