import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mapMySpaceActivity } from './mySpaceActivityApi';

describe('mapMySpaceActivity', () => {
  it('parses post_count and recent posts (id/message/created_at/emotion)', () => {
    const activity = mapMySpaceActivity({
      post_count: 5,
      recent: [
        { id: 'h1', message: 'こんにちは', created_at: '2026-07-10T00:00:00.000Z', emotion: 'joy' },
        { id: 'h2', message: 'ふたつめ', created_at: '2026-07-09T00:00:00.000Z', emotion: 'think' },
      ],
    });

    expect(activity).not.toBeNull();
    expect(activity!.postCount).toBe(5);
    expect(activity!.recentPosts.map((p) => p.id)).toEqual(['h1', 'h2']);
    expect(activity!.recentPosts[0].message).toBe('こんにちは');
    expect(activity!.recentPosts[0].emotion).toBe('joy');
    // lastActivityAt は最新（降順先頭）の created_at
    expect(activity!.lastActivityAt?.toISOString()).toBe('2026-07-10T00:00:00.000Z');
  });

  it('counts posts across panes/pages even when recent is capped at 3', () => {
    // 全 Pane・全ページ合計は 12 件だが、recent は最大 3 件のみ返る想定。
    const activity = mapMySpaceActivity({
      post_count: 12,
      recent: [
        { id: 'a', message: 'x', created_at: '2026-07-10T00:00:00.000Z' },
        { id: 'b', message: 'y', created_at: '2026-07-09T00:00:00.000Z' },
        { id: 'c', message: 'z', created_at: '2026-07-08T00:00:00.000Z' },
      ],
    });
    expect(activity!.postCount).toBe(12);
    expect(activity!.recentPosts).toHaveLength(3);
  });

  it('handles 0 posts (empty recent)', () => {
    const activity = mapMySpaceActivity({ post_count: 0, recent: [] });
    expect(activity).not.toBeNull();
    expect(activity!.postCount).toBe(0);
    expect(activity!.recentPosts).toEqual([]);
    expect(activity!.lastActivityAt).toBeNull();
  });

  it('sorts recent posts by created_at desc regardless of input order', () => {
    const activity = mapMySpaceActivity({
      post_count: 3,
      recent: [
        { id: 'old', message: 'o', created_at: '2026-01-01T00:00:00.000Z' },
        { id: 'new', message: 'n', created_at: '2026-12-01T00:00:00.000Z' },
        { id: 'mid', message: 'm', created_at: '2026-06-01T00:00:00.000Z' },
      ],
    });
    expect(activity!.recentPosts.map((p) => p.id)).toEqual(['new', 'mid', 'old']);
  });

  it('ignores unknown emotion values (falls back to undefined)', () => {
    const activity = mapMySpaceActivity({
      post_count: 1,
      recent: [{ id: 'h', message: 'm', created_at: '2026-07-10T00:00:00.000Z', emotion: 'bogus' }],
    });
    expect(activity!.recentPosts[0].emotion).toBeUndefined();
  });

  it('returns null for malformed payloads (safe fallback)', () => {
    expect(mapMySpaceActivity(null)).toBeNull();
    expect(mapMySpaceActivity(undefined)).toBeNull();
    expect(mapMySpaceActivity('nope')).toBeNull();
    expect(mapMySpaceActivity({ recent: [] })).toBeNull(); // post_count 欠落
    expect(mapMySpaceActivity({ post_count: 'x', recent: [] })).toBeNull();
  });

  it('drops malformed recent rows but keeps valid ones', () => {
    const activity = mapMySpaceActivity({
      post_count: 2,
      recent: [
        { id: 'ok', message: 'm', created_at: '2026-07-10T00:00:00.000Z' },
        { message: 'no id', created_at: '2026-07-09T00:00:00.000Z' },
        { id: 'bad-date', message: 'm', created_at: 'not-a-date' },
      ],
    });
    expect(activity!.recentPosts.map((p) => p.id)).toEqual(['ok']);
  });
});

describe('fetchMySpaceActivity (integration wiring)', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('returns null (safe fallback) when Supabase is not configured', async () => {
    vi.doMock('../supabase', () => ({
      isSupabaseConfigured: false,
      supabase: {},
    }));
    const { fetchMySpaceActivity } = await import('./mySpaceActivityApi');
    expect(await fetchMySpaceActivity('space-1')).toBeNull();
  });

  it('returns null when there is no session (guest)', async () => {
    vi.doMock('../supabase', () => ({
      isSupabaseConfigured: true,
      supabase: {
        auth: { getSession: async () => ({ data: { session: null } }) },
        rpc: vi.fn(),
      },
    }));
    const { fetchMySpaceActivity } = await import('./mySpaceActivityApi');
    expect(await fetchMySpaceActivity('space-1')).toBeNull();
  });

  it('calls get_my_space_activity with p_space_id and maps the result', async () => {
    const rpc = vi.fn(async () => ({
      data: {
        post_count: 4,
        recent: [{ id: 'h1', message: 'hi', created_at: '2026-07-10T00:00:00.000Z' }],
      },
      error: null,
    }));
    vi.doMock('../supabase', () => ({
      isSupabaseConfigured: true,
      supabase: {
        auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) },
        rpc,
      },
    }));
    const { fetchMySpaceActivity } = await import('./mySpaceActivityApi');
    const activity = await fetchMySpaceActivity('space-1');

    expect(rpc).toHaveBeenCalledWith('get_my_space_activity', { p_space_id: 'space-1' });
    expect(activity!.postCount).toBe(4);
    expect(activity!.recentPosts[0].id).toBe('h1');
  });

  it('returns null (safe fallback) when the RPC errors', async () => {
    vi.doMock('../supabase', () => ({
      isSupabaseConfigured: true,
      supabase: {
        auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) },
        rpc: async () => ({ data: null, error: { message: 'boom' } }),
      },
    }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { fetchMySpaceActivity } = await import('./mySpaceActivityApi');
    expect(await fetchMySpaceActivity('space-1')).toBeNull();
  });
});
