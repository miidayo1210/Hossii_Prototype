import { useCallback, useMemo, useReducer, useRef } from 'react';
import type { HossiiConnection, HossiiConnectionStrength } from '../../core/types/hossiiConnection';
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
  errorMessage: string | null;
};

const INITIAL_STATE: EditorState = {
  phase: 'idle',
  sourceId: null,
  targetId: null,
  selectedStrength: null,
  editingConnection: null,
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
  | { type: 'mutationFailure'; message: string };

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
    case 'startEdit':
      return {
        ...INITIAL_STATE,
        phase: 'editing',
        editingConnection: action.connection,
        selectedStrength: action.connection.strength,
      };
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
  }, [guardNotSaving]);

  const chooseTarget = useCallback((targetId: string) => {
    const current = stateRef.current;
    if (current.phase !== 'pickingTarget' || !current.sourceId) return;
    if (!guardNotSaving()) return;
    if (targetId === current.sourceId) {
      dispatch({ type: 'rejectSelfTarget' });
      return;
    }
    dispatch({ type: 'chooseTarget', targetId });
  }, [guardNotSaving]);

  const chooseStrength = useCallback((strength: HossiiConnectionStrength) => {
    const phase = stateRef.current.phase;
    if (phase !== 'pickingStrength' && phase !== 'editing') return;
    if (!guardNotSaving()) return;
    dispatch({ type: 'chooseStrength', strength });
  }, [guardNotSaving]);

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
    [],
  );

  const submitCreate = useCallback(async () => {
    const current = stateRef.current;
    if (current.phase !== 'pickingStrength') return false;
    if (!current.sourceId || !current.targetId || !current.selectedStrength) return false;
    if (!guardNotSaving()) return false;

    const { sourceId, targetId, selectedStrength } = current;
    return runMutation(() =>
      callbacksRef.current.onCreate({
        sourceHossiiId: sourceId,
        targetHossiiId: targetId,
        strength: selectedStrength,
      }),
    );
  }, [guardNotSaving, runMutation]);

  const startEdit = useCallback((connection: HossiiConnection) => {
    if (!guardNotSaving()) return;
    dispatch({ type: 'startEdit', connection });
  }, [guardNotSaving]);

  const submitStrengthUpdate = useCallback(async () => {
    const current = stateRef.current;
    if (current.phase !== 'editing' || !current.editingConnection || !current.selectedStrength) {
      return false;
    }
    if (!guardNotSaving()) return false;

    const { editingConnection, selectedStrength } = current;
    if (selectedStrength === editingConnection.strength) {
      dispatch({ type: 'reset' });
      return true;
    }

    return runMutation(() =>
      callbacksRef.current.onUpdateStrength({
        connectionId: editingConnection.id,
        strength: selectedStrength,
      }),
    );
  }, [guardNotSaving, runMutation]);

  const requestDelete = useCallback(() => {
    if (!guardNotSaving()) return;
    dispatch({ type: 'requestDelete' });
  }, [guardNotSaving]);

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
  }, [guardNotSaving]);

  const reset = useCallback(() => {
    if (!guardNotSaving()) return;
    dispatch({ type: 'reset' });
  }, [guardNotSaving]);

  const snapshot = useMemo(() => toSnapshot(state), [state]);

  return {
    ...snapshot,
    startCreate,
    chooseTarget,
    chooseStrength,
    submitCreate,
    startEdit,
    submitStrengthUpdate,
    requestDelete,
    confirmDelete,
    cancel,
    reset,
  };
}

export type UseConnectionEditorReturn = ReturnType<typeof useConnectionEditor>;
