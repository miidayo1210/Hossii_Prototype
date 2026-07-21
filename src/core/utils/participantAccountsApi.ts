import { supabase, isSupabaseConfigured } from '../supabase';
import {
  buildParticipantAccountRows,
  MAX_PARTICIPANT_ACCOUNT_SLOTS,
} from './participantAccountSlots';

export { buildParticipantAccountRows, MAX_PARTICIPANT_ACCOUNT_SLOTS };
export {
  BULK_ISSUE_FAILURE_MESSAGE,
  BULK_ISSUE_WAITING_HINT,
  BULK_ISSUE_WAITING_LONG_MS,
  clampBulkIssueCount,
  countActiveParticipantAccounts,
  formatBulkIssueInProgressButtonLabel,
  formatBulkIssuePartialMessage,
  formatBulkIssueSuccessMessage,
  formatBulkIssueWaitingLongMessage,
  formatBulkIssueWaitingMessage,
  formatParticipantCredentialsForCopy,
  getAvailableParticipantSlots,
  getOccupiedSlotNumbers,
  isParticipantSlotOccupied,
  selectBulkIssueSlots,
  selectNextIssueSlot,
  validateBulkIssueCount,
} from './participantAccountSlots';

export type ParticipantAccountStatus = 'active' | 'revoked';

export type ParticipantAccount = {
  id: string;
  spaceId: string;
  slotNumber: number;
  loginId: string;
  authUserId: string;
  status: ParticipantAccountStatus;
  firstLoginAt: string | null;
  issuedAt: string;
  issuedBy: string | null;
};

export type ParticipantAccountIssueResult = {
  loginId: string;
  password: string;
  slotNumber: number;
};

export type ParticipantAccountBulkIssueResult = {
  issued: ParticipantAccountIssueResult[];
  count: number;
  partial?: boolean;
  error?: string;
};

export type ParticipantAccountManagementSnapshot = {
  activeAccounts: ParticipantAccount[];
  occupiedSlotNumbers: number[];
};

type ParticipantAccountRow = {
  id: string;
  space_id: string;
  slot_number: number;
  login_id: string;
  auth_user_id: string;
  status: ParticipantAccountStatus;
  first_login_at: string | null;
  issued_at: string;
  issued_by: string | null;
};

type EdgeFunctionAction = 'issue' | 'issue_bulk' | 'regenerate' | 'revoke';

function rowToParticipantAccount(row: ParticipantAccountRow): ParticipantAccount {
  return {
    id: row.id,
    spaceId: row.space_id,
    slotNumber: row.slot_number,
    loginId: row.login_id,
    authUserId: row.auth_user_id,
    status: row.status,
    firstLoginAt: row.first_login_at,
    issuedAt: row.issued_at,
    issuedBy: row.issued_by,
  };
}

export async function fetchParticipantAccounts(spaceId: string): Promise<ParticipantAccount[]> {
  const snapshot = await fetchParticipantAccountManagementSnapshot(spaceId);
  return snapshot.activeAccounts;
}

export async function fetchParticipantAccountManagementSnapshot(
  spaceId: string,
): Promise<ParticipantAccountManagementSnapshot> {
  if (!isSupabaseConfigured) {
    return { activeAccounts: [], occupiedSlotNumbers: [] };
  }

  const { data, error } = await supabase
    .from('space_participant_accounts')
    .select('id, space_id, slot_number, login_id, auth_user_id, status, first_login_at, issued_at, issued_by')
    .eq('space_id', spaceId)
    .order('slot_number', { ascending: true });

  if (error) {
    console.error('[participantAccountsApi] fetchParticipantAccountManagementSnapshot error:', error.message);
    return { activeAccounts: [], occupiedSlotNumbers: [] };
  }

  const records = (data as ParticipantAccountRow[]).map(rowToParticipantAccount);
  return {
    activeAccounts: records.filter((record) => record.status === 'active'),
    occupiedSlotNumbers: records.map((record) => record.slotNumber),
  };
}

async function invokeParticipantAccountAction(
  spaceId: string,
  action: EdgeFunctionAction,
  options?: {
    slotNumber?: number;
    count?: number;
    linkCommunityMembership?: boolean;
    linkSpaceMembership?: boolean;
  },
): Promise<
  | ParticipantAccountIssueResult
  | ParticipantAccountBulkIssueResult
  | { slotNumber: number; revoked: true }
> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured');
  }

  const { data, error } = await supabase.functions.invoke('issue-participant-account', {
    body: {
      spaceId,
      action,
      slotNumber: options?.slotNumber,
      count: options?.count,
      linkCommunityMembership: options?.linkCommunityMembership ?? false,
      linkSpaceMembership: options?.linkSpaceMembership ?? false,
    },
  });

  if (error) {
    console.error('[participantAccountsApi] invoke error:', error.message);
    throw error;
  }

  if (data?.error && !data?.issued) {
    throw new Error(String(data.error));
  }

  return data as
    | ParticipantAccountIssueResult
    | ParticipantAccountBulkIssueResult
    | { slotNumber: number; revoked: true };
}

export type IssueParticipantOptions = {
  linkCommunityMembership?: boolean;
  linkSpaceMembership?: boolean;
};

export async function issueParticipantAccount(
  spaceId: string,
  slotNumber?: number,
  options?: IssueParticipantOptions,
): Promise<ParticipantAccountIssueResult> {
  const result = await invokeParticipantAccountAction(spaceId, 'issue', {
    slotNumber,
    linkCommunityMembership: options?.linkCommunityMembership,
    linkSpaceMembership: options?.linkSpaceMembership,
  });
  return result as ParticipantAccountIssueResult;
}

export async function issueParticipantAccountsBulk(
  spaceId: string,
  count: number,
  options?: IssueParticipantOptions,
): Promise<ParticipantAccountBulkIssueResult> {
  const result = await invokeParticipantAccountAction(spaceId, 'issue_bulk', {
    count,
    linkCommunityMembership: options?.linkCommunityMembership,
    linkSpaceMembership: options?.linkSpaceMembership,
  });
  return result as ParticipantAccountBulkIssueResult;
}

export async function regenerateParticipantPassword(
  spaceId: string,
  slotNumber: number
): Promise<ParticipantAccountIssueResult> {
  const result = await invokeParticipantAccountAction(spaceId, 'regenerate', { slotNumber });
  return result as ParticipantAccountIssueResult;
}

export async function revokeParticipantAccount(
  spaceId: string,
  slotNumber: number
): Promise<void> {
  await invokeParticipantAccountAction(spaceId, 'revoke', { slotNumber });
}

export async function resolveParticipantLogin(
  spaceId: string,
  loginId: string
): Promise<string | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase.rpc('resolve_participant_login', {
    p_space_id: spaceId,
    p_login_id: loginId.trim(),
  });

  if (error) {
    console.error('[participantAccountsApi] resolveParticipantLogin error:', error.message);
    return null;
  }

  return typeof data === 'string' ? data : null;
}

export async function markParticipantFirstLogin(authUserId: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase.rpc('mark_participant_first_login', {
    p_auth_user_id: authUserId,
  });

  if (error) {
    console.error('[participantAccountsApi] markParticipantFirstLogin error:', error.message);
  }
}
