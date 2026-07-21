import { beforeEach, describe, expect, it, vi } from 'vitest';

type QueryResult = { data: unknown; error: unknown };

const supabaseMock = vi.hoisted(() => {
  let likesRows: Array<{ hossii_id: string; user_id: string }> = [];
  let hossiiLikeCounts = new Map<string, number>();

  const from = vi.fn((table: string) => {
    const filters: Record<string, string> = {};
    const api = {
      select: vi.fn(() => api),
      eq: vi.fn((col: string, val: string) => {
        filters[col] = val;
        return api;
      }),
      in: vi.fn((_col: string, ids: string[]) => {
        filters.__in = ids.join(',');
        return api;
      }),
      maybeSingle: vi.fn(async (): Promise<QueryResult> => {
        if (table === 'hossii_likes') {
          const row = likesRows.find(
            (r) =>
              r.hossii_id === filters.hossii_id &&
              r.user_id === filters.user_id
          );
          return { data: row ?? null, error: null };
        }
        if (table === 'hossiis') {
          const count = hossiiLikeCounts.get(filters.id) ?? 0;
          return { data: { like_count: count }, error: null };
        }
        return { data: null, error: null };
      }),
      insert: vi.fn(async (row: { hossii_id: string; user_id: string }) => {
        likesRows.push(row);
        const current = hossiiLikeCounts.get(row.hossii_id) ?? 0;
        hossiiLikeCounts.set(row.hossii_id, current + 1);
        return { error: null };
      }),
      delete: vi.fn(() => ({
        eq: vi.fn((_col: string, val: string) => ({
          eq: vi.fn(async (_col2: string, val2: string) => {
            const had = likesRows.some(
              (r) => r.hossii_id === val && r.user_id === val2
            );
            likesRows = likesRows.filter(
              (r) => !(r.hossii_id === val && r.user_id === val2)
            );
            if (had) {
              const current = hossiiLikeCounts.get(val) ?? 0;
              hossiiLikeCounts.set(val, Math.max(0, current - 1));
            }
            return { error: null };
          }),
        })),
      })),
    };
    return api;
  });

  return {
    configured: true,
    rpc: vi.fn(),
    from,
    reset() {
      likesRows = [];
      hossiiLikeCounts = new Map();
      this.rpc.mockReset();
      this.from.mockClear();
    },
    setLikeCount(hossiiId: string, count: number) {
      hossiiLikeCounts.set(hossiiId, count);
    },
    seedLike(hossiiId: string, userId: string) {
      likesRows.push({ hossii_id: hossiiId, user_id: userId });
    },
  };
});

vi.mock('../supabase', () => ({
  get isSupabaseConfigured() {
    return supabaseMock.configured;
  },
  supabase: {
    rpc: (name: string, args: unknown) => supabaseMock.rpc(name, args),
    from: (table: string) => supabaseMock.from(table),
  },
}));

import {
  fetchHossiiLikeCount,
  incrementLike,
  mutateLike,
  toggleLike,
} from './likesApi';

describe('incrementLike (Phase 2D-1 privacy-hardened RPC)', () => {
  beforeEach(() => {
    supabaseMock.reset();
    supabaseMock.configured = true;
  });

  it('returns the new count for a likeable (public) post', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: 7, error: null });
    await expect(incrementLike('h1')).resolves.toBe(7);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('increment_hossii_like', { p_hossii_id: 'h1' });
  });

  it('maps NULL (owner_only/deleted/non-existent → not likeable) to 0 without leaking', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: null, error: null });
    await expect(incrementLike('hidden-or-missing')).resolves.toBe(0);
  });

  it('returns 0 on error (no PII propagated to caller)', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(incrementLike('h1')).resolves.toBe(0);
  });

  it('returns 0 when Supabase is not configured (no rpc call)', async () => {
    supabaseMock.configured = false;
    await expect(incrementLike('h1')).resolves.toBe(0);
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it('never returns negative counts from RPC', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: -1, error: null });
    await expect(incrementLike('h1')).resolves.toBe(0);
  });
});

describe('fetchHossiiLikeCount', () => {
  beforeEach(() => {
    supabaseMock.reset();
    supabaseMock.configured = true;
  });

  it('returns stored like_count clamped to 0', async () => {
    supabaseMock.setLikeCount('h1', 3);
    await expect(fetchHossiiLikeCount('h1')).resolves.toBe(3);
  });

  it('clamps negative DB values to 0', async () => {
    supabaseMock.setLikeCount('h1', -2);
    await expect(fetchHossiiLikeCount('h1')).resolves.toBe(0);
  });
});

describe('toggleLike', () => {
  beforeEach(() => {
    supabaseMock.reset();
    supabaseMock.configured = true;
    supabaseMock.setLikeCount('h1', 0);
  });

  it('like 0 → 1 returns server-confirmed count', async () => {
    await expect(toggleLike('h1', 'u1')).resolves.toEqual({ liked: true, likeCount: 1 });
  });

  it('unlike 1 → 0 returns server-confirmed count', async () => {
    supabaseMock.setLikeCount('h1', 1);
    supabaseMock.seedLike('h1', 'u1');
    await expect(toggleLike('h1', 'u1')).resolves.toEqual({ liked: false, likeCount: 0 });
  });

  it('does not go below 0 on unlike', async () => {
    supabaseMock.setLikeCount('h1', 0);
    supabaseMock.seedLike('h1', 'u1');
    await expect(toggleLike('h1', 'u1')).resolves.toEqual({ liked: false, likeCount: 0 });
  });
});

describe('mutateLike', () => {
  beforeEach(() => {
    supabaseMock.reset();
    supabaseMock.configured = true;
    supabaseMock.setLikeCount('h1', 0);
  });

  it('uses toggleLike for logged-in users', async () => {
    await expect(mutateLike('h1', 'u1')).resolves.toEqual({ liked: true, likeCount: 1 });
  });

  it('uses incrementLike for guests and throws on failure', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: 2, error: null });
    await expect(mutateLike('h1')).resolves.toEqual({ liked: true, likeCount: 2 });
  });

  it('throws when guest increment returns 0', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: 0, error: null });
    await expect(mutateLike('h1')).rejects.toThrow('incrementLike failed');
  });

  it('throws when Supabase is not configured', async () => {
    supabaseMock.configured = false;
    await expect(mutateLike('h1', 'u1')).rejects.toThrow('Supabase not configured');
  });
});
