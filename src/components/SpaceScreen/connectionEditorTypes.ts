import type { HossiiConnection, HossiiConnectionStrength } from '../../core/types/hossiiConnection';

export type ConnectionEditorPhase =
  | 'idle'
  | 'pickingTarget'
  | 'pickingStrength'
  | 'saving'
  | 'editing'
  | 'deleting'
  | 'error';

export type ConnectionMutationResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

export type ConnectionEditorCallbacks = {
  onCreate: (input: {
    sourceHossiiId: string;
    targetHossiiId: string;
    strength: HossiiConnectionStrength;
  }) => Promise<ConnectionMutationResult<HossiiConnection>>;
  onUpdateStrength: (input: {
    connectionId: string;
    strength: HossiiConnectionStrength;
  }) => Promise<ConnectionMutationResult<HossiiConnection>>;
  onDelete: (input: {
    connectionId: string;
  }) => Promise<ConnectionMutationResult<{ id: string }>>;
};

export type ConnectionEditorSnapshot = {
  phase: ConnectionEditorPhase;
  sourceId: string | null;
  targetId: string | null;
  selectedStrength: HossiiConnectionStrength | null;
  editingConnection: HossiiConnection | null;
  errorMessage: string | null;
  isSaving: boolean;
  canCancel: boolean;
};

export const CONNECTION_SELF_TARGET_ERROR = '自分自身にはつなげません';
