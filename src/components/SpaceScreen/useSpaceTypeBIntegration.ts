import { useCallback, useMemo } from 'react';
import type { RefObject } from 'react';
import type { AppUser } from '../../core/contexts/AuthContext';
import type { Hossii } from '../../core/types';
import type { DisplayPeriod } from '../../core/utils/displayPrefsStorage';
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
  spaceId: string;
  paneId: string;
  setSelectedBubbleId: (id: string | null) => void;
  filteredHossiis: Hossii[];
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
  existingPositions: readonly { x: number; y: number }[],
) {
  const originX = hossii.positionX ?? 50;
  const originY = hossii.positionY ?? 50;
  return computeTypeBNearOriginPlacement({
    origin: { x: originX, y: originY },
    existingPositions,
    seed: hossii.id,
  });
}

export function useSpaceTypeBIntegration({
  editor,
  typeAEditorPhase,
  currentUser,
  spaceId,
  paneId,
  setSelectedBubbleId,
  filteredHossiis,
  refetchConnections,
  syncFetchedHossiis,
  screenQueryKey,
  displayPeriod,
  paneContext,
  getExistingHossiis,
  bubbleAreaRef,
  onPostPanelOpen,
  onPostPanelClose,
}: Options) {
  const typeABlocksTypeB = isTypeAEditorBlockingTypeB(typeAEditorPhase);

  const existingPlacementPoints = useMemo(
    () =>
      filteredHossiis
        .filter((h) => h.positionX != null && h.positionY != null)
        .map((h) => ({ x: h.positionX!, y: h.positionY! })),
    [filteredHossiis],
  );

  const hossiiById = useMemo(
    () => new Map(filteredHossiis.map((h) => [h.id, h])),
    [filteredHossiis],
  );

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
    if (editor.phase === 'error' || editor.isActive) {
      handleCancel();
    }
  }, [editor.isSubmitting, editor.phase, editor.isActive, handleCancel]);

  const postScreenTypeBMode = editor.isActive
    ? {
        prompt: TYPE_B_EDITOR_PROMPT,
        draftMessage: editor.draftMessage,
        onDraftChange: editor.setDraftMessage,
        onSubmit: () => void handleSubmit(),
        submitting: editor.isSubmitting,
        errorMessage: editor.errorMessage,
        onRetry: () => void handleSubmit(),
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
    startFromOrigin,
    handleCancel,
    handleSubmit,
    handleEscapeReset,
    postScreenTypeBMode,
    provisionalThread,
    bubbleAreaRef,
    typeBPostOpen: editor.isActive,
  };
}

export type SpaceTypeBIntegration = ReturnType<typeof useSpaceTypeBIntegration>;
