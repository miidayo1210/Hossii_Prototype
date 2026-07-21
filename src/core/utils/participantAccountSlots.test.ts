import { describe, expect, it } from 'vitest';
import {
  buildParticipantAccountRows,
  clampBulkIssueCount,
  formatParticipantCredentialsForCopy,
  getAvailableParticipantSlots,
  getOccupiedSlotNumbers,
  isParticipantSlotOccupied,
  MAX_PARTICIPANT_ACCOUNT_SLOTS,
  selectBulkIssueSlots,
  selectNextIssueSlot,
  validateBulkIssueCount,
} from './participantAccountSlots';

function makeAccount(
  slotNumber: number,
  status: 'active' | 'revoked' = 'active',
  loginId = `demo-${String(slotNumber).padStart(2, '0')}`,
) {
  return {
    id: `id-${slotNumber}-${status}`,
    spaceId: 'space-1',
    slotNumber,
    loginId,
    authUserId: `auth-${slotNumber}`,
    status,
    firstLoginAt: null,
    issuedAt: '2026-07-21T00:00:00.000Z',
    issuedBy: null,
  };
}

describe('MAX_PARTICIPANT_ACCOUNT_SLOTS', () => {
  it('allows up to 50 accounts per space', () => {
    expect(MAX_PARTICIPANT_ACCOUNT_SLOTS).toBe(50);
  });
});

describe('getOccupiedSlotNumbers', () => {
  it('includes both active and revoked records', () => {
    expect(
      getOccupiedSlotNumbers([makeAccount(1, 'active'), makeAccount(2, 'revoked')]),
    ).toEqual([1, 2]);
  });
});

describe('buildParticipantAccountRows', () => {
  it('generates 50 rows including empty slots', () => {
    const rows = buildParticipantAccountRows([]);
    expect(rows).toHaveLength(50);
    expect(rows.every((row) => row === null)).toBe(true);
  });

  it('maps active accounts passed by the caller into rows', () => {
    const rows = buildParticipantAccountRows([makeAccount(1, 'active'), makeAccount(21, 'active')]);

    expect(rows[0]?.slotNumber).toBe(1);
    expect(rows[20]?.slotNumber).toBe(21);
    expect(rows[1]).toBeNull();
  });
});

describe('getAvailableParticipantSlots', () => {
  it('returns all slots when none are occupied in DB', () => {
    expect(getAvailableParticipantSlots([])).toEqual(
      Array.from({ length: 50 }, (_, index) => index + 1),
    );
  });

  it('does not treat revoked slots as available', () => {
    const occupied = getOccupiedSlotNumbers([makeAccount(2, 'revoked')]);
    const available = getAvailableParticipantSlots(occupied);

    expect(available).not.toContain(2);
    expect(available[0]).toBe(1);
  });

  it('returns smallest available slots first and skips occupied slots', () => {
    const occupied = getOccupiedSlotNumbers([
      makeAccount(2, 'active'),
      makeAccount(5, 'active'),
      makeAccount(21, 'revoked'),
    ]);
    const available = getAvailableParticipantSlots(occupied);

    expect(available[0]).toBe(1);
    expect(available).not.toContain(2);
    expect(available).not.toContain(5);
    expect(available).not.toContain(21);
    expect(available).toContain(3);
    expect(available).toContain(22);
  });

  it('with slot 1 active and slot 2 revoked, next issue slot is 3', () => {
    const occupied = getOccupiedSlotNumbers([makeAccount(1, 'active'), makeAccount(2, 'revoked')]);
    expect(selectNextIssueSlot(occupied)).toBe(3);
  });

  it('allows 25 new slots when 20 active and 5 revoked occupy distinct slots', () => {
    const active = Array.from({ length: 20 }, (_, index) => makeAccount(index + 1, 'active'));
    const revoked = Array.from({ length: 5 }, (_, index) => makeAccount(index + 21, 'revoked'));
    const occupied = getOccupiedSlotNumbers([...active, ...revoked]);

    expect(getAvailableParticipantSlots(occupied)).toHaveLength(25);
  });

  it('blocks new issuance when all 50 slots have DB records including revoked', () => {
    const records = Array.from({ length: 50 }, (_, index) =>
      makeAccount(index + 1, index % 2 === 0 ? 'active' : 'revoked'),
    );
    const occupied = getOccupiedSlotNumbers(records);

    expect(getAvailableParticipantSlots(occupied)).toEqual([]);
    expect(validateBulkIssueCount(1, 0)).toMatch(/新規発行可能は0件/);
  });
});

describe('selectBulkIssueSlots', () => {
  it('skips revoked slots and issues from smallest unused slots', () => {
    const occupied = getOccupiedSlotNumbers([
      makeAccount(1, 'active'),
      makeAccount(2, 'revoked'),
      makeAccount(4, 'active'),
    ]);

    expect(selectBulkIssueSlots(occupied, 3)).toEqual([3, 5, 6]);
  });
});

describe('selectNextIssueSlot', () => {
  it('matches single-issue slot selection', () => {
    const occupied = getOccupiedSlotNumbers([makeAccount(1, 'active'), makeAccount(2, 'revoked')]);
    expect(selectNextIssueSlot(occupied)).toBe(3);
  });
});

describe('isParticipantSlotOccupied', () => {
  it('returns true for revoked slots', () => {
    const occupied = getOccupiedSlotNumbers([makeAccount(7, 'revoked')]);
    expect(isParticipantSlotOccupied(7, occupied)).toBe(true);
    expect(isParticipantSlotOccupied(8, occupied)).toBe(false);
  });
});

describe('validateBulkIssueCount', () => {
  it('accepts counts within available slots up to 50', () => {
    expect(validateBulkIssueCount(10, 30)).toBeNull();
    expect(validateBulkIssueCount(50, 50)).toBeNull();
  });

  it('rejects zero, negative, fractional, and over-limit counts', () => {
    expect(validateBulkIssueCount(0, 10)).toMatch(/1以上/);
    expect(validateBulkIssueCount(-1, 10)).toMatch(/1以上/);
    expect(validateBulkIssueCount(1.5, 10)).toMatch(/整数/);
    expect(validateBulkIssueCount(51, 50)).toMatch(/最大50/);
  });

  it('rejects counts above available slots', () => {
    expect(validateBulkIssueCount(10, 5)).toMatch(/新規発行可能は5件/);
  });

  it('rejects non-number input', () => {
    expect(validateBulkIssueCount('10', 10)).toMatch(/整数/);
    expect(validateBulkIssueCount(undefined, 10)).toMatch(/整数/);
  });
});

describe('clampBulkIssueCount', () => {
  it('clamps to available slots and minimum of 1', () => {
    expect(clampBulkIssueCount(10, 5)).toBe(5);
    expect(clampBulkIssueCount(0, 5)).toBe(1);
    expect(clampBulkIssueCount(100, 50)).toBe(50);
  });

  it('returns 1 when no slots are available', () => {
    expect(clampBulkIssueCount(10, 0)).toBe(1);
  });
});

describe('formatParticipantCredentialsForCopy', () => {
  it('formats credentials as TSV for spreadsheet paste', () => {
    const text = formatParticipantCredentialsForCopy([
      { loginId: 'demo-01', password: 'abc12345', slotNumber: 1 },
      { loginId: 'demo-02', password: 'xyz98765', slotNumber: 2 },
    ]);

    expect(text).toBe(
      ['参加ID\tパスワード', 'demo-01\tabc12345', 'demo-02\txyz98765'].join('\n'),
    );
  });

  it('returns empty string for no accounts', () => {
    expect(formatParticipantCredentialsForCopy([])).toBe('');
  });
});
