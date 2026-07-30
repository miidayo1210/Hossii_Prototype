import { describe, expect, it, vi } from 'vitest';

const rpcMock = vi.fn();

vi.mock('../supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: vi.fn(),
  },
}));

import {
  rowToChallengeReward,
  submitChallengeCommentResponse,
  type ChallengeRewardRow,
} from './challengeRewardsApi';

describe('challengeRewardsApi', () => {
  it('maps reward rows', () => {
    const row: ChallengeRewardRow = {
      id: 'rw1',
      completion_id: 'c1',
      user_id: 'u1',
      item_id: 'i1',
      hossii_key: 'emotion/wow',
      awarded_at: '2026-07-31T00:00:00.000Z',
      created_at: '2026-07-31T00:00:00.000Z',
    };
    const mapped = rowToChallengeReward(row);
    expect(mapped.hossiiKey).toBe('emotion/wow');
    expect(mapped.completionId).toBe('c1');
  });

  it('rejects empty comment before RPC', async () => {
    const result = await submitChallengeCommentResponse({
      itemId: 'i1',
      comment: '   ',
    });
    expect(result.ok).toBe(false);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('calls RPC without user_id or hossii_key', async () => {
    rpcMock.mockResolvedValue({
      data: {
        response: {
          id: 'r1',
          item_id: 'i1',
          user_id: 'u1',
          visibility: 'manager_only',
          comment: 'hello',
          created_at: '2026-07-31T00:00:00.000Z',
          updated_at: '2026-07-31T00:00:00.000Z',
        },
        completion: {
          id: 'c1',
          item_id: 'i1',
          user_id: 'u1',
          response_id: 'r1',
          completed_at: '2026-07-31T00:00:00.000Z',
          created_at: '2026-07-31T00:00:00.000Z',
        },
        reward: {
          id: 'rw1',
          completion_id: 'c1',
          user_id: 'u1',
          item_id: 'i1',
          hossii_key: 'emotion/wow',
          awarded_at: '2026-07-31T00:00:00.000Z',
          created_at: '2026-07-31T00:00:00.000Z',
        },
        is_new_reward: true,
        was_insert: true,
      },
      error: null,
    });

    const result = await submitChallengeCommentResponse({
      itemId: 'i1',
      comment: ' hello ',
      visibility: 'self_only',
    });

    expect(rpcMock).toHaveBeenCalledWith('submit_challenge_comment_response', {
      p_item_id: 'i1',
      p_comment: 'hello',
      p_visibility: 'self_only',
    });
    expect(result.ok && result.value.isNewReward).toBe(true);
    expect(result.ok && result.value.reward.hossiiKey).toBe('emotion/wow');
  });

  it('surfaces permission errors', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'active membership required', code: '42501' },
    });
    const result = await submitChallengeCommentResponse({
      itemId: 'i1',
      comment: 'x',
    });
    expect(result).toEqual({
      ok: false,
      error: '権限がありません',
      code: '42501',
    });
  });
});
