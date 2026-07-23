import { createPortal } from 'react-dom';
import type { UseConnectionEditorReturn } from './useConnectionEditor';
import { ConnectionStrengthPopover } from './ConnectionStrengthPopover';
import { ConnectionDeleteConfirmPopover } from './ConnectionDeleteConfirmPopover';
import styles from './ConnectionEditorPopover.module.css';
import { useConnectionPopoverViewport } from '../../core/hooks/useConnectionPopoverViewport';
import { useHossiiAnchorRect } from '../../core/hooks/useHossiiAnchorRect';

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

type Props = {
  editor: UseConnectionEditorReturn;
  selectedBubbleId: string | null;
  canUseConnectionEditor: boolean;
  isConnectionsContextEnabled: boolean;
};

export function ConnectionEditorPortals({
  editor,
  selectedBubbleId,
  canUseConnectionEditor,
  isConnectionsContextEnabled,
}: Props) {
  const {
    phase,
    targetId,
    sourceId,
    editingConnection,
    selectedStrength,
    reasonExpanded,
    draftReasonText,
    draftReasonEmoji,
    errorMessage,
    isSaving,
    chooseStrength,
    toggleReasonExpanded,
    setDraftReasonText,
    toggleDraftReasonEmoji,
    submitSave,
    requestDelete,
    confirmDelete,
    cancel,
  } = editor;

  const editorPortalEnabled = canUseConnectionEditor && isConnectionsContextEnabled;
  const strengthPopoverViewport = useConnectionPopoverViewport();

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
    strengthPopoverViewport,
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
          viewport={strengthPopoverViewport}
          anchorRect={strengthAnchorRect}
          mode={strengthMode}
          selectedStrength={selectedStrength}
          reasonExpanded={reasonExpanded}
          draftReasonText={draftReasonText}
          draftReasonEmoji={draftReasonEmoji}
          onSelectStrength={chooseStrength}
          onToggleReasonExpanded={toggleReasonExpanded}
          onDraftReasonTextChange={setDraftReasonText}
          onToggleDraftReasonEmoji={toggleDraftReasonEmoji}
          onPrimaryAction={submitSave}
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
