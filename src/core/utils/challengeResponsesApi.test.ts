import { describe, expect, it, vi } from 'vitest';

vi.mock('../supabase', () => ({
  isSupabaseConfigured: false,
  supabase: {
    from: vi.fn(),
    auth: { getSession: vi.fn() },
  },
}));

import {
  rowToChallengeResponse,
  type ChallengeResponseRow,
} from './challengeResponsesApi';
import {
  normalizeChallengeResponseComment,
  normalizeCreateChallengeResponseInput,
  normalizeUpdateChallengeResponseInput,
} from './challengeResponseValidation';

describe('challengeResponseValidation', () => {
  it('rejects empty comment after trim', () => {
    expect(normalizeChallengeResponseComment('   ').ok).toBe(false);
  });

  it('rejects comment over 500 characters', () => {
    expect(normalizeChallengeResponseComment('あ'.repeat(501)).ok).toBe(false);
  });

  it('defaults visibility to manager_only', () => {
    expect(
      normalizeCreateChallengeResponseInput({
        itemId: 'item-1',
        comment: ' hello ',
      }),
    ).toEqual({
      ok: true,
      value: {
        itemId: 'item-1',
        comment: 'hello',
        visibility: 'manager_only',
      },
    });
  });

  it('rejects invalid visibility and empty itemId', () => {
    expect(
      normalizeCreateChallengeResponseInput({
        itemId: '  ',
        comment: 'x',
        visibility: 'public' as 'self_only',
      }).ok,
    ).toBe(false);
    expect(
      normalizeCreateChallengeResponseInput({
        itemId: '',
        comment: 'x',
      }).ok,
    ).toBe(false);
  });

  it('rejects update with no fields', () => {
    expect(normalizeUpdateChallengeResponseInput({}).ok).toBe(false);
  });
});

describe('challengeResponsesApi mapping', () => {
  it('maps snake_case row to domain type', () => {
    const row: ChallengeResponseRow = {
      id: 'r1',
      item_id: 'i1',
      user_id: 'u1',
      visibility: 'self_only',
      comment: '回答',
      created_at: '2026-07-31T00:00:00.000Z',
      updated_at: '2026-07-31T01:00:00.000Z',
    };
    const mapped = rowToChallengeResponse(row);
    expect(mapped.itemId).toBe('i1');
    expect(mapped.userId).toBe('u1');
    expect(mapped.visibility).toBe('self_only');
    expect(mapped.photoPath).toBeNull();
    expect(mapped.createdAt).toBeInstanceOf(Date);
  });

  it('maps photo_path when present', () => {
    const row: ChallengeResponseRow = {
      id: 'r2',
      item_id: 'i2',
      user_id: 'u2',
      visibility: 'space_members',
      comment: '写真',
      photo_path: 'challenge/space/i2/u2/33333333-3333-4333-8333-333333333333.jpg',
      created_at: '2026-07-31T00:00:00.000Z',
      updated_at: '2026-07-31T01:00:00.000Z',
    };
    expect(rowToChallengeResponse(row).photoPath).toBe(row.photo_path);
  });
});
