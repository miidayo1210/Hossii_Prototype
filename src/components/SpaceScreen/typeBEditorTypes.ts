export type TypeBEditorPhase = 'idle' | 'composing' | 'submitting' | 'error';

export const TYPE_B_EDITOR_PROMPT = 'ここから、何が広がった？';

export type TypeBEditorSnapshot = {
  phase: TypeBEditorPhase;
  originHossiiId: string | null;
  idempotencyKey: string | null;
  newHossiiId: string | null;
  positionX: number | null;
  positionY: number | null;
  draftMessage: string;
  errorMessage: string | null;
};

export function isTypeBEditorBubbleSwitchBlocked(phase: TypeBEditorPhase): boolean {
  return phase === 'composing' || phase === 'submitting';
}

export function isTypeBEditorActive(phase: TypeBEditorPhase): boolean {
  return phase !== 'idle';
}

export function shouldShowTypeBProvisionalThread(phase: TypeBEditorPhase): boolean {
  return phase === 'composing';
}
