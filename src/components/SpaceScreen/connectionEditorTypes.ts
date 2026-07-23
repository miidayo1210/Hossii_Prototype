import type {
  HossiiConnection,
  HossiiConnectionReasonEmoji,
  HossiiConnectionStrength,
} from '../../core/types/hossiiConnection';

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
    reasonText?: string | null;
    reasonEmoji?: HossiiConnectionReasonEmoji | null;
  }) => Promise<ConnectionMutationResult<HossiiConnection>>;
  onUpdateStrength: (input: {
    connectionId: string;
    strength: HossiiConnectionStrength;
  }) => Promise<ConnectionMutationResult<HossiiConnection>>;
  onUpdateReason: (input: {
    connectionId: string;
    reasonText?: string | null;
    reasonEmoji?: HossiiConnectionReasonEmoji | null;
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
  reasonExpanded: boolean;
  draftReasonText: string;
  draftReasonEmoji: HossiiConnectionReasonEmoji | null;
  errorMessage: string | null;
  isSaving: boolean;
  canCancel: boolean;
};

export const CONNECTION_SELF_TARGET_ERROR = '自分自身にはつなげません';
