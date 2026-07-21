export const MAX_PARTICIPANT_ACCOUNT_SLOTS = 50;

export type ParticipantAccountSlotView = {
  slotNumber: number;
};

export type ParticipantCredentialRow = {
  loginId: string;
  password: string;
  slotNumber: number;
};

export function getOccupiedSlotNumbers(
  records: Array<{ slotNumber: number }>,
): number[] {
  return records.map((record) => record.slotNumber);
}

export function buildParticipantAccountRows<T extends ParticipantAccountSlotView>(
  activeAccounts: T[],
): Array<T | null> {
  const bySlot = new Map(activeAccounts.map((account) => [account.slotNumber, account]));
  return Array.from({ length: MAX_PARTICIPANT_ACCOUNT_SLOTS }, (_, index) =>
    bySlot.get(index + 1) ?? null,
  );
}

export function getAvailableParticipantSlots(
  occupiedSlotNumbers: Iterable<number>,
): number[] {
  const occupiedSlots = new Set(occupiedSlotNumbers);
  return Array.from({ length: MAX_PARTICIPANT_ACCOUNT_SLOTS }, (_, index) => index + 1).filter(
    (slotNumber) => !occupiedSlots.has(slotNumber),
  );
}

export function isParticipantSlotOccupied(
  slotNumber: number,
  occupiedSlotNumbers: Iterable<number>,
): boolean {
  return new Set(occupiedSlotNumbers).has(slotNumber);
}

export function countActiveParticipantAccounts<T extends { status: 'active' | 'revoked' }>(
  accounts: T[],
): number {
  return accounts.filter((account) => account.status === 'active').length;
}

export function validateBulkIssueCount(
  count: unknown,
  availableSlotCount: number,
): string | null {
  if (typeof count !== 'number' || !Number.isInteger(count)) {
    return '発行件数は整数で指定してください';
  }
  if (count < 1) {
    return '発行件数は1以上で指定してください';
  }
  if (count > MAX_PARTICIPANT_ACCOUNT_SLOTS) {
    return `発行件数は最大${MAX_PARTICIPANT_ACCOUNT_SLOTS}件までです`;
  }
  if (count > availableSlotCount) {
    return `新規発行可能は${availableSlotCount}件です`;
  }
  return null;
}

export function formatParticipantCredentialsForCopy(
  accounts: ParticipantCredentialRow[],
): string {
  if (accounts.length === 0) return '';

  const header = '参加ID\tパスワード';
  const rows = accounts.map((account) => `${account.loginId}\t${account.password}`);
  return [header, ...rows].join('\n');
}

export function clampBulkIssueCount(
  count: number,
  availableSlotCount: number,
): number {
  if (availableSlotCount <= 0) return 1;
  return Math.min(Math.max(1, count), availableSlotCount, MAX_PARTICIPANT_ACCOUNT_SLOTS);
}

export function selectNextIssueSlot(
  occupiedSlotNumbers: Iterable<number>,
): number | null {
  const [nextSlot] = getAvailableParticipantSlots(occupiedSlotNumbers);
  return nextSlot ?? null;
}

export function selectBulkIssueSlots(
  occupiedSlotNumbers: Iterable<number>,
  count: number,
): number[] {
  return getAvailableParticipantSlots(occupiedSlotNumbers).slice(0, count);
}
