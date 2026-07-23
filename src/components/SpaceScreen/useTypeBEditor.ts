import { useCallback, useMemo, useReducer, useRef } from 'react';
import { generateId } from '../../core/utils';
import type { TypeBEditorPhase, TypeBEditorSnapshot } from './typeBEditorTypes';
import {
  canResetTypeBEditor,
  isTypeBEditorBubbleSwitchBlocked,
} from './typeBEditorTypes';

type EditorState = TypeBEditorSnapshot;

const INITIAL_STATE: EditorState = {
  phase: 'idle',
  originHossiiId: null,
  idempotencyKey: null,
  newHossiiId: null,
  positionX: null,
  positionY: null,
  draftMessage: '',
  errorMessage: null,
};

type StartCreateInput = {
  originHossiiId: string;
  positionX: number;
  positionY: number;
};

function createTypeBIdempotencyKey(): string {
  return crypto.randomUUID();
}

type Action =
  | { type: 'reset' }
  | { type: 'startCreate'; input: StartCreateInput }
  | { type: 'setDraftMessage'; message: string }
  | { type: 'beginSubmit' }
  | { type: 'submitSuccess' }
  | { type: 'submitFailure'; message: string };

function reducer(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case 'reset':
      return { ...INITIAL_STATE };
    case 'startCreate':
      return {
        phase: 'composing',
        originHossiiId: action.input.originHossiiId,
        idempotencyKey: createTypeBIdempotencyKey(),
        newHossiiId: generateId(),
        positionX: action.input.positionX,
        positionY: action.input.positionY,
        draftMessage: '',
        errorMessage: null,
      };
    case 'setDraftMessage':
      if (state.phase === 'idle') return state;
      return { ...state, draftMessage: action.message };
    case 'beginSubmit':
      if (state.phase !== 'composing' && state.phase !== 'error') return state;
      return { ...state, phase: 'submitting', errorMessage: null };
    case 'submitSuccess':
      return { ...INITIAL_STATE };
    case 'submitFailure':
      if (state.phase !== 'submitting') return state;
      return { ...state, phase: 'error', errorMessage: action.message };
    default:
      return state;
  }
}

export function useTypeBEditor() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const submitInFlightRef = useRef(false);

  const reset = useCallback(() => {
    submitInFlightRef.current = false;
    dispatch({ type: 'reset' });
  }, []);

  const startCreate = useCallback((input: StartCreateInput) => {
    submitInFlightRef.current = false;
    dispatch({ type: 'startCreate', input });
  }, []);

  const setDraftMessage = useCallback((message: string) => {
    dispatch({ type: 'setDraftMessage', message });
  }, []);

  const beginSubmit = useCallback((): boolean => {
    if (submitInFlightRef.current) return false;
    if (state.phase !== 'composing' && state.phase !== 'error') return false;
    submitInFlightRef.current = true;
    dispatch({ type: 'beginSubmit' });
    return true;
  }, [state.phase]);

  const submitSuccess = useCallback(() => {
    submitInFlightRef.current = false;
    dispatch({ type: 'submitSuccess' });
  }, []);

  const submitFailure = useCallback((message: string) => {
    submitInFlightRef.current = false;
    dispatch({ type: 'submitFailure', message });
  }, []);

  const cancel = useCallback(() => {
    if (state.phase === 'submitting') return;
    reset();
  }, [state.phase, reset]);

  const snapshot = useMemo(
    (): TypeBEditorSnapshot & {
      isBubbleSwitchBlocked: boolean;
      isActive: boolean;
      showProvisionalThread: boolean;
      isSubmitting: boolean;
      canReset: boolean;
    } => ({
      ...state,
      isBubbleSwitchBlocked: isTypeBEditorBubbleSwitchBlocked(state.phase),
      isActive: state.phase !== 'idle',
      showProvisionalThread: state.phase === 'composing',
      isSubmitting: state.phase === 'submitting',
      canReset: canResetTypeBEditor(state.phase),
    }),
    [state],
  );

  return {
    ...snapshot,
    startCreate,
    setDraftMessage,
    beginSubmit,
    submitSuccess,
    submitFailure,
    cancel,
    reset,
  };
}

export type TypeBEditorHandle = ReturnType<typeof useTypeBEditor>;

/** Type A editor phase から Type B 起動をブロックする */
export function isTypeAEditorBlockingTypeB(typeAPhase: string): boolean {
  return typeAPhase !== 'idle' && typeAPhase !== 'error';
}

/** Type B editor phase から Type A 起動をブロックする */
export function isTypeBEditorBlockingTypeA(typeBPhase: TypeBEditorPhase): boolean {
  return typeBPhase !== 'idle';
}
