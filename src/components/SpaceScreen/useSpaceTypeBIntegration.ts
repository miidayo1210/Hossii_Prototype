import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import type { AppUser } from '../../core/contexts/AuthContext';
import type { Hossii } from '../../core/types';
import type { Space } from '../../core/types/space';
import type { DisplayPeriod, LayoutMode, ViewMode } from '../../core/utils/displayPrefsStorage';
import type { PresentationMode } from '../../core/utils/presentationModeStorage';
import type { ActiveSpaceMembershipStatus } from '../../core/utils/membershipJoinController';
import { evaluateTypeBConnectionWriteGate } from '../../core/utils/typeBConnectionWriteGate';
import { formatConnectionCreateBlockedReasonMessage } from '../../core/utils/formatConnectionCreateBlockedReasonMessage';
import { computeTypeBNearOriginPlacement } from '../../core/utils/typeBNearOriginPlacement';
import {
  createTypeBConnectedHossii,
  TYPE_B_MESSAGE_MAX_LENGTH,
} from '../../core/utils/typeBCreateApi';
import { refetchSpaceHossiisAfterMutation } from '../../core/utils/refetchSpaceHossiisAfterMutation';
import type { PaneContext } from '../../core/utils/hossiiPaneMembership';
import type { HossiiQueryKey } from '../../core/utils/hossiiQueryKey';
import type { ConnectionEditorPhase } from './connectionEditorTypes';
import { TYPE_B_EDITOR_PROMPT } from './typeBEditorTypes';
import {
  isTypeAEditorBlockingTypeB,
  isTypeBEditorBlockingTypeA,
  type TypeBEditorHandle,
} from './useTypeBEditor';

type Options = {
  editor: TypeBEditorHandle;
  typeAEditorPhase: ConnectionEditorPhase;
  currentUser: AppUser | null | undefined;
  activeSpace: Space | null | undefined;
  isContentArchived: boolean;
  activeSpaceMembershipStatus: ActiveSpaceMembershipStatus;
  spaceId: string;
  paneId: string;
  selectedBubbleId: string | null;
  setSelectedBubbleId: (id: string | null) => void;
  filteredHossiis: Hossii[];
  isConnectionsContextEnabled: boolean;
  refetchConnections: () => void;
  syncFetchedHossiis: (
    items: Hossii[],
    queryKey: HossiiQueryKey,
    options?: { merge?: boolean },
  ) => void;
  screenQueryKey: HossiiQueryKey | null;
  displayPeriod: DisplayPeriod;
  paneContext: PaneContext | null;
  getExistingHossiis: () => Hossii[];
  bubbleAreaRef: RefObject<HTMLElement | null>;
  contextActivePaneId: string | null | undefined;
  presentationMode: PresentationMode;
  viewMode: ViewMode;
  layoutMode: LayoutMode;
  onPostPanelOpen?: () => void;
  onPostPanelClose?: () => void;
};

export function formatTypeBSubmitErrorMessage(error: { message: string; code?: string }): string {
  if (error.code === 'RPC_NOT_AVAILABLE') {
    return `${error.message} (RPC_NOT_AVAILABLE)`;
  }
  return error.message;
}

function resolveOriginPlacement(
  hossii: Hossii,
  existingPositions: readonly { x: number; y: number; id: string }[],
) {
  const originX = hossii.positionX ?? 50;
  const originY = hossii.positionY ?? 50;
  const others = existingPositions
    .filter((point) => point.id !== hossii.id)
    .map(({ x, y }) => ({ x, y }));
  return computeTypeBNearOriginPlacement({
    origin: { x: originX, y: originY },
    existingPositions: others,
    seed: hossii.id,
  });
}

export function evaluateTypeBSubmitGate(input: {
  isConnectionsContextEnabled: boolean;
  writeGate: ReturnType<typeof evaluateTypeBConnectionWriteGate>;
  originHossiiId: string | null;
  originExists: boolean;
}): string | null {
  if (!input.isConnectionsContextEnabled) {
    return 'この表示ではつなげて作れません';
  }
  if (!input.writeGate.canCreate) {
    return (
      formatConnectionCreateBlockedReasonMessage(input.writeGate.blockReason) ??
      'つなげて作る権限がありません'
    );
  }
  if (!input.originHossiiId || !input.originExists) {
    return '起点の Bubble が見つかりません';
  }
  return null;
}

export function useSpaceTypeBIntegration({
  editor,
  typeAEditorPhase,
  currentUser,
  activeSpace,
  isContentArchived,
  activeSpaceMembershipStatus,
  spaceId,
  paneId,
  selectedBubbleId,
  setSelectedBubbleId,
  filteredHossiis,
  isConnectionsContextEnabled,
  refetchConnections,
  syncFetchedHossiis,
  screenQueryKey,
  displayPeriod,
  paneContext,
  getExistingHossiis,
  bubbleAreaRef,
  contextActivePaneId,
  presentationMode,
  viewMode,
  layoutMode,
  onPostPanelOpen,
  onPostPanelClose,
}: Options) {
  const typeABlocksTypeB = isTypeAEditorBlockingTypeB(typeAEditorPhase);

  const typeBWriteGate = useMemo(
    () =>
      evaluateTypeBConnectionWriteGate({
        currentUser,
        activeSpace,
        isContentArchived,
        activeSpaceMembershipStatus,
      }),
    [currentUser, activeSpace, isContentArchived, activeSpaceMembershipStatus],
  );

  const existingPlacementPoints = useMemo(
    () =>
      filteredHossiis
        .filter((h) => h.positionX != null && h.positionY != null)
        .map((h) => ({ id: h.id, x: h.positionX!, y: h.positionY! })),
    [filteredHossiis],
  );

  const hossiiById = useMemo(
    () => new Map(filteredHossiis.map((h) => [h.id, h])),
    [filteredHossiis],
  );

  const resetIfAllowed = useCallback((): boolean => {
    if (editor.isSubmitting) return false;
    if (!editor.isActive) return true;
    editor.cancel();
    onPostPanelClose?.();
    return true;
  }, [editor, onPostPanelClose]);

  const editorPhaseRef = useRef(editor.phase);
  const editorCancelRef = useRef(editor.cancel);
  const onPostPanelCloseRef = useRef(onPostPanelClose);

  useEffect(() => {
    editorPhaseRef.current = editor.phase;
    editorCancelRef.current = editor.cancel;
    onPostPanelCloseRef.current = onPostPanelClose;
  }, [editor.phase, editor.cancel, onPostPanelClose]);

  const startFromOrigin = useCallback(
    (originHossiiId: string) => {
      if (typeABlocksTypeB || editor.isActive) return;

      const origin = hossiiById.get(originHossiiId);
      if (!origin) return;

      const placement = resolveOriginPlacement(origin, existingPlacementPoints);
      editor.startCreate({
        originHossiiId,
        positionX: placement.positionX,
        positionY: placement.positionY,
      });
      onPostPanelOpen?.();
    },
    [typeABlocksTypeB, editor, hossiiById, existingPlacementPoints, onPostPanelOpen],
  );

  const handleCancel = useCallback(() => {
    if (editor.isSubmitting) return;
    editor.cancel();
    onPostPanelClose?.();
  }, [editor, onPostPanelClose]);

  const handleSubmit = useCallback(async () => {
    if (!editor.beginSubmit()) return;

    const message = editor.draftMessage.trim();
    if (!message) {
      editor.submitFailure('メッセージを入力してください');
      return;
    }
    if (message.length > TYPE_B_MESSAGE_MAX_LENGTH) {
      editor.submitFailure(`メッセージは${TYPE_B_MESSAGE_MAX_LENGTH}文字以内にしてください`);
      return;
    }

    if (
      !editor.originHossiiId ||
      !editor.idempotencyKey ||
      !editor.newHossiiId ||
      editor.positionX == null ||
      editor.positionY == null
    ) {
      editor.submitFailure('投稿の準備ができていません');
      return;
    }

    const gateError = evaluateTypeBSubmitGate({
      isConnectionsContextEnabled,
      writeGate: typeBWriteGate,
      originHossiiId: editor.originHossiiId,
      originExists: hossiiById.has(editor.originHossiiId),
    });
    if (gateError) {
      editor.submitFailure(gateError);
      return;
    }

    const result = await createTypeBConnectedHossii({
      idempotencyKey: editor.idempotencyKey,
      spaceId,
      paneId,
      originHossiiId: editor.originHossiiId,
      newHossiiId: editor.newHossiiId,
      message,
      positionX: editor.positionX,
      positionY: editor.positionY,
      authorId: currentUser?.uid ?? null,
      authorName: currentUser?.displayName ?? null,
    });

    if (!result.ok) {
      editor.submitFailure(formatTypeBSubmitErrorMessage(result));
      return;
    }

    if (screenQueryKey) {
      try {
        const merged = await refetchSpaceHossiisAfterMutation({
          spaceId,
          displayPeriod,
          paneContext,
          existingHossiis: getExistingHossiis(),
        });
        syncFetchedHossiis(merged, screenQueryKey, { merge: false });
      } catch {
        // refetch 失敗でも RPC 成功分は connections refetch で追従
      }
    }

    refetchConnections();
    setSelectedBubbleId(result.result.newHossiiId);
    editor.submitSuccess();
    onPostPanelClose?.();
  }, [
    editor,
    isConnectionsContextEnabled,
    typeBWriteGate,
    hossiiById,
    spaceId,
    paneId,
    currentUser,
    screenQueryKey,
    displayPeriod,
    paneContext,
    getExistingHossiis,
    syncFetchedHossiis,
    refetchConnections,
    setSelectedBubbleId,
    onPostPanelClose,
  ]);

  const handleEscapeReset = useCallback(() => {
    if (editor.isSubmitting) return;
    if (editor.canReset || editor.phase === 'error') {
      handleCancel();
    }
  }, [editor.isSubmitting, editor.canReset, editor.phase, handleCancel]);

  const prevPaneIdRef = useRef(contextActivePaneId);
  const prevPresentationModeRef = useRef(presentationMode);
  const prevLayoutModeRef = useRef(layoutMode);
  const prevViewModeRef = useRef(viewMode);

  useEffect(() => {
    const prev = prevPaneIdRef.current;
    if (prev != null && contextActivePaneId != null && prev !== contextActivePaneId) {
      resetIfAllowed();
    }
    prevPaneIdRef.current = contextActivePaneId;
  }, [contextActivePaneId, resetIfAllowed]);

  useEffect(() => {
    if (prevLayoutModeRef.current !== layoutMode && layoutMode === 'byAuthor') {
      resetIfAllowed();
    }
    prevLayoutModeRef.current = layoutMode;
  }, [layoutMode, resetIfAllowed]);

  useEffect(() => {
    if (prevViewModeRef.current !== viewMode && viewMode === 'slideshow') {
      resetIfAllowed();
    }
    prevViewModeRef.current = viewMode;
  }, [viewMode, resetIfAllowed]);

  useEffect(() => {
    if (prevPresentationModeRef.current !== presentationMode) {
      resetIfAllowed();
    }
    prevPresentationModeRef.current = presentationMode;
  }, [presentationMode, resetIfAllowed]);

  useEffect(() => {
    if (editor.phase === 'idle' || editor.phase === 'submitting') return;
    if (editor.originHossiiId && !hossiiById.has(editor.originHossiiId)) {
      resetIfAllowed();
    }
  }, [editor.phase, editor.originHossiiId, hossiiById, resetIfAllowed]);

  useEffect(() => {
    if (editor.phase === 'idle' || editor.phase === 'submitting') return;
    if (selectedBubbleId == null) {
      resetIfAllowed();
    }
  }, [selectedBubbleId, editor.phase, resetIfAllowed]);

  useEffect(() => {
    return () => {
      if (editorPhaseRef.current === 'submitting') return;
      if (editorPhaseRef.current !== 'idle') {
        editorCancelRef.current();
        onPostPanelCloseRef.current?.();
      }
    };
  }, []);

  const postScreenTypeBMode = editor.isActive
    ? {
        prompt: TYPE_B_EDITOR_PROMPT,
        draftMessage: editor.draftMessage,
        onDraftChange: editor.setDraftMessage,
        onSubmit: () => void handleSubmit(),
        submitting: editor.isSubmitting,
        errorMessage: editor.errorMessage,
        onRetry: () => void handleSubmit(),
        closeDisabled: editor.isSubmitting,
      }
    : null;

  const provisionalThread =
    editor.showProvisionalThread &&
    editor.originHossiiId != null &&
    editor.positionX != null &&
    editor.positionY != null
      ? {
          originHossiiId: editor.originHossiiId,
          positionX: editor.positionX,
          positionY: editor.positionY,
        }
      : null;

  return {
    editor,
    isTypeBEditorBlockingTypeA: isTypeBEditorBlockingTypeA(editor.phase),
    isBubbleSwitchBlocked: editor.isBubbleSwitchBlocked,
    isTypeBEditorActive: editor.isActive,
    startFromOrigin,
    handleCancel,
    handleSubmit,
    handleEscapeReset,
    resetIfAllowed,
    postScreenTypeBMode,
    provisionalThread,
    bubbleAreaRef,
    typeBPostOpen: editor.isActive,
  };
}

export type SpaceTypeBIntegration = ReturnType<typeof useSpaceTypeBIntegration>;
