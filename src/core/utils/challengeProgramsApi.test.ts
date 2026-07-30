import { describe, expect, it, vi } from 'vitest';

vi.mock('../supabase', () => ({
  isSupabaseConfigured: false,
  supabase: { from: vi.fn() },
}));

import {
  buildCreateChallengeItemPayload,
  buildCreateChallengeProgramPayload,
  buildUpdateChallengeItemPayload,
  buildUpdateChallengeProgramPayload,
  rowToChallengeItem,
  rowToChallengeProgram,
  type ChallengeItemRow,
  type ChallengeProgramRow,
} from './challengeProgramsApi';
import {
  normalizeChallengeProgramStatus,
  normalizeCreateChallengeItemInput,
  normalizeCreateChallengeProgramInput,
  normalizeUpdateChallengeItemInput,
  normalizeUpdateChallengeProgramInput,
} from './challengeValidation';

describe('challengeValidation', () => {
  it('rejects empty title', () => {
    expect(normalizeCreateChallengeProgramInput({ spaceId: 's1', title: '   ' }).ok).toBe(false);
  });

  it('rejects title over 200 characters', () => {
    const title = 'あ'.repeat(201);
    expect(normalizeCreateChallengeProgramInput({ spaceId: 's1', title }).ok).toBe(false);
  });

  it('rejects invalid status', () => {
    expect(normalizeChallengeProgramStatus('live').ok).toBe(false);
  });

  it('accepts defined statuses', () => {
    for (const status of ['draft', 'published', 'ended', 'archived'] as const) {
      expect(normalizeChallengeProgramStatus(status)).toEqual({ ok: true, value: status });
    }
  });

  it('rejects invalid itemType', () => {
    expect(
      normalizeCreateChallengeItemInput({
        programId: 'p1',
        title: 'q',
        itemType: 'quiz' as 'question',
      }).ok,
    ).toBe(false);
  });

  it('rejects invalid responseType', () => {
    expect(
      normalizeCreateChallengeItemInput({
        programId: 'p1',
        title: 'q',
        responseType: 'choice3' as 'comment',
      }).ok,
    ).toBe(false);
  });

  it('rejects negative sortOrder', () => {
    expect(
      normalizeCreateChallengeItemInput({
        programId: 'p1',
        title: 'q',
        sortOrder: -1,
      }).ok,
    ).toBe(false);
  });

  it('rejects empty spaceId / programId', () => {
    expect(normalizeCreateChallengeProgramInput({ spaceId: '', title: 't' }).ok).toBe(false);
    expect(normalizeCreateChallengeItemInput({ programId: '  ', title: 't' }).ok).toBe(false);
  });

  it('trims title and nullable text', () => {
    const program = normalizeCreateChallengeProgramInput({
      spaceId: ' s1 ',
      title: '  hello  ',
      description: '  desc  ',
    });
    expect(program).toEqual({
      ok: true,
      value: { spaceId: 's1', title: 'hello', description: 'desc' },
    });

    const item = normalizeCreateChallengeItemInput({
      programId: 'p1',
      title: ' item ',
      description: '   ',
      reason: null,
    });
    expect(item.ok && item.value.description).toBeNull();
    expect(item.ok && item.value.reason).toBeNull();
  });

  it('rejects empty update payloads', () => {
    expect(normalizeUpdateChallengeProgramInput({}).ok).toBe(false);
    expect(normalizeUpdateChallengeItemInput({}).ok).toBe(false);
  });
});

describe('row mapping', () => {
  it('maps program snake_case row to camelCase app type', () => {
    const row: ChallengeProgramRow = {
      id: '11111111-1111-1111-1111-111111111111',
      space_id: 'dev-space-public',
      title: 'Story',
      description: null,
      status: 'draft',
      created_by: 'beb03671-2a42-465b-b1d6-65c2e2e6695f',
      created_at: '2026-07-31T00:00:00.000Z',
      updated_at: '2026-07-31T01:00:00.000Z',
    };
    const program = rowToChallengeProgram(row);
    expect(program).toMatchObject({
      id: row.id,
      spaceId: 'dev-space-public',
      title: 'Story',
      description: null,
      status: 'draft',
      createdBy: row.created_by,
    });
    expect(program.createdAt.toISOString()).toBe('2026-07-31T00:00:00.000Z');
    expect(program.updatedAt.toISOString()).toBe('2026-07-31T01:00:00.000Z');
  });

  it('maps item row including boolean and sort_order', () => {
    const row: ChallengeItemRow = {
      id: '22222222-2222-2222-2222-222222222222',
      program_id: '11111111-1111-1111-1111-111111111111',
      item_type: 'mission',
      title: 'Do it',
      description: 'desc',
      reason: 'why',
      response_type: 'photo',
      is_required: false,
      sort_order: 3,
      created_at: '2026-07-31T00:00:00.000Z',
      updated_at: '2026-07-31T00:00:00.000Z',
    };
    expect(rowToChallengeItem(row)).toMatchObject({
      programId: row.program_id,
      itemType: 'mission',
      responseType: 'photo',
      isRequired: false,
      sortOrder: 3,
      description: 'desc',
      reason: 'why',
    });
  });
});

describe('payload builders', () => {
  it('create program payload omits created_by and status', () => {
    const payload = buildCreateChallengeProgramPayload({
      spaceId: 's1',
      title: 't',
      description: null,
    });
    expect(payload).toEqual({
      space_id: 's1',
      title: 't',
      description: null,
    });
    expect(payload).not.toHaveProperty('created_by');
    expect(payload).not.toHaveProperty('status');
    expect(payload).not.toHaveProperty('id');
  });

  it('update program payload does not include space_id', () => {
    const payload = buildUpdateChallengeProgramPayload({ title: 'n', description: 'd' });
    expect(payload).toEqual({ title: 'n', description: 'd' });
    expect(payload).not.toHaveProperty('space_id');
    expect(payload).not.toHaveProperty('status');
  });

  it('update item payload does not include program_id', () => {
    const payload = buildUpdateChallengeItemPayload({
      title: 'n',
      sortOrder: 2,
      itemType: 'question',
    });
    expect(payload).toEqual({
      title: 'n',
      sort_order: 2,
      item_type: 'question',
    });
    expect(payload).not.toHaveProperty('program_id');
  });

  it('create item payload maps fields and defaults are applied by validation first', () => {
    const normalized = normalizeCreateChallengeItemInput({
      programId: 'p1',
      title: 'q',
    });
    expect(normalized.ok).toBe(true);
    if (!normalized.ok) return;
    const payload = buildCreateChallengeItemPayload(normalized.value);
    expect(payload).toEqual({
      program_id: 'p1',
      item_type: 'question',
      title: 'q',
      description: null,
      reason: null,
      response_type: 'comment',
      is_required: true,
      sort_order: 0,
    });
  });
});

describe('list sort_order contract', () => {
  it('row mapper preserves sortOrder for client-side ordering checks', () => {
    const rows: ChallengeItemRow[] = [
      {
        id: 'a',
        program_id: 'p',
        item_type: 'question',
        title: '2',
        description: null,
        reason: null,
        response_type: 'comment',
        is_required: true,
        sort_order: 2,
        created_at: '2026-07-31T00:00:02.000Z',
        updated_at: '2026-07-31T00:00:02.000Z',
      },
      {
        id: 'b',
        program_id: 'p',
        item_type: 'question',
        title: '0',
        description: null,
        reason: null,
        response_type: 'comment',
        is_required: true,
        sort_order: 0,
        created_at: '2026-07-31T00:00:00.000Z',
        updated_at: '2026-07-31T00:00:00.000Z',
      },
    ];
    const sorted = rows.map(rowToChallengeItem).sort((a, b) => a.sortOrder - b.sortOrder);
    expect(sorted.map((i) => i.title)).toEqual(['0', '2']);
  });
});
