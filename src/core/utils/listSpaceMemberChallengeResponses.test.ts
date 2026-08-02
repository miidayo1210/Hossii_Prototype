import { beforeEach, describe, expect, it, vi } from 'vitest';

const fromMock = vi.fn();

vi.mock('../supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import { listSpaceMemberChallengeResponses } from './challengeResponsesApi';

describe('listSpaceMemberChallengeResponses', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('queries only space_members rows for the given item ids', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'r1',
          item_id: 'i1',
          user_id: 'u1',
          visibility: 'space_members',
          comment: 'shared',
          created_at: '2026-08-01T00:00:00.000Z',
          updated_at: '2026-08-01T00:00:00.000Z',
        },
      ],
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ order });
    const inFilter = vi.fn().mockReturnValue({ eq });
    const select = vi.fn().mockReturnValue({ in: inFilter });
    fromMock.mockReturnValue({ select });

    const rows = await listSpaceMemberChallengeResponses(['i1', ' i2 ', '']);

    expect(fromMock).toHaveBeenCalledWith('challenge_responses');
    expect(inFilter).toHaveBeenCalledWith('item_id', ['i1', 'i2']);
    expect(eq).toHaveBeenCalledWith('visibility', 'space_members');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.visibility).toBe('space_members');
    expect(rows[0]?.comment).toBe('shared');
  });

  it('returns empty without querying when item ids are empty', async () => {
    const rows = await listSpaceMemberChallengeResponses([]);
    expect(rows).toEqual([]);
    expect(fromMock).not.toHaveBeenCalled();
  });
});
