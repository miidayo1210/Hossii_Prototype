import { describe, expect, it, vi, beforeEach } from 'vitest';

const rpcMock = vi.fn();
const fromMock = vi.fn();

vi.mock('../supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import {
  listMyChallengeCompletions,
  listMyChallengeRewards,
  rowToChallengeReward,
  submitChallengeCommentResponse,
  type ChallengeRewardRow,
} from './challengeRewardsApi';

function mockSelectChain(rows: unknown[]) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.order = vi.fn(async () => ({ data: rows, error: null }));
  fromMock.mockReturnValue(chain);
  return chain;
}

describe('challengeRewardsApi', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
  });

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

  it('lists my rewards filtered by item ids', async () => {
    const chain = mockSelectChain([
      {
        id: 'rw1',
        completion_id: 'c1',
        user_id: 'u1',
        item_id: 'i1',
        hossii_key: 'emotion/wow',
        awarded_at: '2026-07-31T00:00:00.000Z',
        created_at: '2026-07-31T00:00:00.000Z',
      },
    ]);
    const rewards = await listMyChallengeRewards(['i1', ' i2 ']);
    expect(fromMock).toHaveBeenCalledWith('challenge_rewards');
    expect(chain.in).toHaveBeenCalledWith('item_id', ['i1', 'i2']);
    expect(rewards).toHaveLength(1);
    expect(rewards[0].itemId).toBe('i1');
  });

  it('lists my completions filtered by item ids', async () => {
    const chain = mockSelectChain([
      {
        id: 'c1',
        item_id: 'i1',
        user_id: 'u1',
        response_id: null,
        completed_at: '2026-07-31T00:00:00.000Z',
        created_at: '2026-07-31T00:00:00.000Z',
      },
    ]);
    const completions = await listMyChallengeCompletions(['i1']);
    expect(fromMock).toHaveBeenCalledWith('challenge_completions');
    expect(chain.in).toHaveBeenCalledWith('item_id', ['i1']);
    expect(completions).toHaveLength(1);
    expect(completions[0].itemId).toBe('i1');
  });

  it('returns empty array when list query has no rows', async () => {
    mockSelectChain([]);
    await expect(listMyChallengeRewards(['missing'])).resolves.toEqual([]);
    await expect(listMyChallengeCompletions(['missing'])).resolves.toEqual([]);
  });

  it('returns empty without querying when itemIds is empty', async () => {
    await expect(listMyChallengeRewards([])).resolves.toEqual([]);
    await expect(listMyChallengeCompletions([])).resolves.toEqual([]);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('returns empty without querying when itemIds are whitespace-only', async () => {
    await expect(listMyChallengeRewards(['  ', ''])).resolves.toEqual([]);
    await expect(listMyChallengeCompletions(['  '])).resolves.toEqual([]);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('throws on supabase list errors', async () => {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    chain.select = vi.fn(() => chain);
    chain.in = vi.fn(() => chain);
    chain.order = vi.fn(async () => ({ data: null, error: { message: 'boom' } }));
    fromMock.mockReturnValue(chain);
    await expect(listMyChallengeRewards(['i1'])).rejects.toThrow('boom');
    await expect(listMyChallengeCompletions(['i1'])).rejects.toThrow('boom');
  });
});
