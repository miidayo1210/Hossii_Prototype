import { useCallback, useMemo, useReducer, useRef } from 'react';
import type {
  HossiiConnection,
  HossiiConnectionReasonEmoji,
  HossiiConnectionStrength,
} from '../../core/types/hossiiConnection';
import {
  buildCreateReasonFields,
  buildReasonUpdateDelta,
} from '../../core/utils/connectionReasonEditor';
import {
  CONNECTION_SELF_TARGET_ERROR,
  type ConnectionEditorCallbacks,
  type ConnectionEditorPhase,
  type ConnectionEditorSnapshot,
  type ConnectionMutationResult,
} from './connectionEditorTypes';

type EditorState = {
  phase: ConnectionEditorPhase;
  sourceId: string | null;
  targetId: string | null;
  selectedStrength: HossiiConnectionStrength | null;
  editingConnection: HossiiConnection | null;
  reasonExpanded: boolean;
  draftReasonText: string;
  draftReasonEmoji: HossiiConnectionReasonEmoji | null;
  errorMessage: string | null;
};

const INITIAL_REASON = {
  reasonExpanded: false,
  draftReasonText: '',
  draftReasonEmoji: null as HossiiConnectionReasonEmoji | null,
};

const INITIAL_STATE: EditorState = {
  phase: 'idle',
  sourceId: null,
  targetId: null,
  selectedStrength: null,
  editingConnection: null,
  ...INITIAL_REASON,
  errorMessage: null,
};

type Action =
  | { type: 'reset' }
  | { type: 'startCreate'; sourceId: string }
  | { type: 'rejectSelfTarget' }
  | { type: 'chooseTarget'; targetId: string }
  | { type: 'chooseStrength'; strength: HossiiConnectionStrength }
  | { type: 'startSaving' }
  | { type: 'startEdit'; connection: HossiiConnection }
  | { type: 'requestDelete' }
  | { type: 'cancelFromDeleting' }
  | { type: 'mutationSuccess' }
  | { type: 'mutationFailure'; message: string }
  | { type: 'setValidationError'; message: string }
  | { type: 'toggleReasonExpanded' }
  | { type: 'setDraftReasonText'; text: string }
  | { type: 'toggleDraftReasonEmoji'; emoji: HossiiConnectionReasonEmoji };

function reducer(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case 'reset':
      return { ...INITIAL_STATE };
    case 'startCreate':
      return {
        ...INITIAL_STATE,
        phase: 'pickingTarget',
        sourceId: action.sourceId,
      };
    case 'rejectSelfTarget':
      return {
        ...state,
        errorMessage: CONNECTION_SELF_TARGET_ERROR,
      };
    case 'chooseTarget':
      return {
        ...state,
        phase: 'pickingStrength',
        targetId: action.targetId,
        selectedStrength: 'medium',
        ...INITIAL_REASON,
        errorMessage: null,
      };
    case 'chooseStrength':
      return {
        ...state,
        selectedStrength: action.strength,
        errorMessage: null,
      };
    case 'startSaving':
      return {
        ...state,
        phase: 'saving',
        errorMessage: null,
      };
    case 'startEdit': {
      const hasReason = Boolean(
        action.connection.reasonText?.trim() || action.connection.reasonEmoji,
      );
      return {
        ...INITIAL_STATE,
        phase: 'editing',
        editingConnection: action.connection,
        selectedStrength: action.connection.strength,
        draftReasonText: action.connection.reasonText ?? '',
        draftReasonEmoji: action.connection.reasonEmoji,
        reasonExpanded: hasReason,
      };
    }
    case 'requestDelete':
      if (state.phase !== 'editing' || !state.editingConnection) return state;
      return {
        ...state,
        phase: 'deleting',
        errorMessage: null,
      };
    case 'cancelFromDeleting':
      if (state.phase !== 'deleting' || !state.editingConnection) return state;
      return {
        ...state,
        phase: 'editing',
        errorMessage: null,
      };
    case 'mutationSuccess':
      return { ...INITIAL_STATE };
    case 'mutationFailure':
      return {
        ...state,
        phase: 'error',
        errorMessage: action.message,
      };
    case 'setValidationError':
      return {
        ...state,
        errorMessage: action.message,
      };
    case 'toggleReasonExpanded':
      return {
        ...state,
        reasonExpanded: !state.reasonExpanded,
        errorMessage: null,
      };
    case 'setDraftReasonText':
      return {
        ...state,
        draftReasonText: action.text,
        errorMessage: null,
      };
    case 'toggleDraftReasonEmoji':
      return {
        ...state,
        draftReasonEmoji:
          state.draftReasonEmoji === action.emoji ? null : action.emoji,
        errorMessage: null,
      };
    default:
      return state;
  }
}

function toSnapshot(state: EditorState): ConnectionEditorSnapshot {
  return {
    phase: state.phase,
    sourceId: state.sourceId,
    targetId: state.targetId,
    selectedStrength: state.selectedStrength,
    editingConnection: state.editingConnection,
    reasonExpanded: state.reasonExpanded,
    draftReasonText: state.draftReasonText,
    draftReasonEmoji: state.draftReasonEmoji,
    errorMessage: state.errorMessage,
    isSaving: state.phase === 'saving',
    canCancel: state.phase !== 'saving',
  };
}

export function useConnectionEditor(callbacks: ConnectionEditorCallbacks) {
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const [state, dispatchBase] = useReducer(reducer, INITIAL_STATE);
  const stateRef = useRef(state);
  const inFlightRef = useRef(false);

  const dispatch = useCallback((action: Action) => {
    stateRef.current = reducer(stateRef.current, action);
    dispatchBase(action);
  }, []);

  const guardNotSaving = useCallback(() => {
    return stateRef.current.phase !== 'saving' && !inFlightRef.current;
  }, []);

  const startCreate = useCallback((sourceId: string) => {
    if (!guardNotSaving()) return;
    dispatch({ type: 'startCreate', sourceId });
  }, [guardNotSaving, dispatch]);

  const chooseTarget = useCallback((targetId: string) => {
    const current = stateRef.current;
    if (current.phase !== 'pickingTarget' || !current.sourceId) return;
    if (!guardNotSaving()) return;
    if (targetId === current.sourceId) {
      dispatch({ type: 'rejectSelfTarget' });
      return;
    }
    dispatch({ type: 'chooseTarget', targetId });
  }, [guardNotSaving, dispatch]);

  const chooseStrength = useCallback((strength: HossiiConnectionStrength) => {
    const phase = stateRef.current.phase;
    if (phase !== 'pickingStrength' && phase !== 'editing') return;
    if (!guardNotSaving()) return;
    dispatch({ type: 'chooseStrength', strength });
  }, [guardNotSaving, dispatch]);

  const toggleReasonExpanded = useCallback(() => {
    if (!guardNotSaving()) return;
    dispatch({ type: 'toggleReasonExpanded' });
  }, [guardNotSaving, dispatch]);

  const setDraftReasonText = useCallback((text: string) => {
    if (!guardNotSaving()) return;
    dispatch({ type: 'setDraftReasonText', text });
  }, [guardNotSaving, dispatch]);

  const toggleDraftReasonEmoji = useCallback((emoji: HossiiConnectionReasonEmoji) => {
    if (!guardNotSaving()) return;
    dispatch({ type: 'toggleDraftReasonEmoji', emoji });
  }, [guardNotSaving, dispatch]);

  const runMutation = useCallback(
    async <T,>(
      invoke: () => Promise<ConnectionMutationResult<T>>,
    ): Promise<boolean> => {
      if (inFlightRef.current || stateRef.current.phase === 'saving') return false;
      inFlightRef.current = true;
      dispatch({ type: 'startSaving' });
      try {
        const result = await invoke();
        if (result.ok) {
          dispatch({ type: 'mutationSuccess' });
          return true;
        }
        dispatch({ type: 'mutationFailure', message: result.message });
        return false;
      } finally {
        inFlightRef.current = false;
      }
    },
    [dispatch],
  );

  const submitSave = useCallback(async () => {
    const current = stateRef.current;
    const isCreate = current.phase === 'pickingStrength';
    const isEdit = current.phase === 'editing';

    if (!isCreate && !isEdit) return false;
    if (!guardNotSaving()) return false;

    if (isCreate) {
      if (!current.sourceId || !current.targetId || !current.selectedStrength) return false;

      const reasonResult = buildCreateReasonFields(
        current.draftReasonText,
        current.draftReasonEmoji,
      );
      if (!reasonResult.ok) {
        dispatch({ type: 'setValidationError', message: reasonResult.message });
        return false;
      }

      const { sourceId, targetId, selectedStrength } = current;
      return runMutation(() =>
        callbacksRef.current.onCreate({
          sourceHossiiId: sourceId,
          targetHossiiId: targetId,
          strength: selectedStrength,
          ...reasonResult.fields,
        }),
      );
    }

    const connection = current.editingConnection;
    if (!connection || !current.selectedStrength) return false;

    const reasonDeltaResult = buildReasonUpdateDelta(
      {
        reasonText: connection.reasonText,
        reasonEmoji: connection.reasonEmoji,
      },
      current.draftReasonText,
      current.draftReasonEmoji,
    );
    if (!reasonDeltaResult.ok) {
      dispatch({ type: 'setValidationError', message: reasonDeltaResult.message });
      return false;
    }

    const strengthChanged = current.selectedStrength !== connection.strength;
    const reasonChanged = reasonDeltaResult.delta !== null;

    if (!strengthChanged && !reasonChanged) {
      dispatch({ type: 'reset' });
      return true;
    }

    return runMutation(async () => {
      let lastData: HossiiConnection = connection;

      if (strengthChanged) {
        const strengthResult = await callbacksRef.current.onUpdateStrength({
          connectionId: connection.id,
          strength: current.selectedStrength!,
        });
        if (!strengthResult.ok) return strengthResult;
        lastData = strengthResult.data;
      }

      if (reasonChanged && reasonDeltaResult.delta) {
        const reasonResult = await callbacksRef.current.onUpdateReason({
          connectionId: connection.id,
          ...reasonDeltaResult.delta,
        });
        if (!reasonResult.ok) return reasonResult;
        lastData = reasonResult.data;
      }

      return { ok: true as const, data: lastData };
    });
  }, [guardNotSaving, runMutation, dispatch]);

  const submitCreate = submitSave;
  const submitStrengthUpdate = submitSave;

  const startEdit = useCallback((connection: HossiiConnection) => {
    if (!guardNotSaving()) return;
    dispatch({ type: 'startEdit', connection });
  }, [guardNotSaving, dispatch]);

  const requestDelete = useCallback(() => {
    if (!guardNotSaving()) return;
    dispatch({ type: 'requestDelete' });
  }, [guardNotSaving, dispatch]);

  const confirmDelete = useCallback(async () => {
    const current = stateRef.current;
    if (current.phase !== 'deleting' || !current.editingConnection) return false;
    if (!guardNotSaving()) return false;

    const connectionId = current.editingConnection.id;
    return runMutation(() => callbacksRef.current.onDelete({ connectionId }));
  }, [guardNotSaving, runMutation]);

  const cancel = useCallback(() => {
    if (!guardNotSaving()) return;
    if (stateRef.current.phase === 'deleting') {
      dispatch({ type: 'cancelFromDeleting' });
      return;
    }
    dispatch({ type: 'reset' });
  }, [guardNotSaving, dispatch]);

  const reset = useCallback(() => {
    if (!guardNotSaving()) return;
    dispatch({ type: 'reset' });
  }, [guardNotSaving, dispatch]);

  const snapshot = useMemo(() => toSnapshot(state), [state]);

  return {
    ...snapshot,
    startCreate,
    chooseTarget,
    chooseStrength,
    toggleReasonExpanded,
    setDraftReasonText,
    toggleDraftReasonEmoji,
    submitSave,
    submitCreate,
    submitStrengthUpdate,
    startEdit,
    requestDelete,
    confirmDelete,
    cancel,
    reset,
  };
}

export type UseConnectionEditorReturn = ReturnType<typeof useConnectionEditor>;
