import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ADMIN_EXPORT_MAX_LIMIT,
  clampAdminExportLimit,
  fetchAdminExportPage,
  fetchAllAdminExportHossiis,
  isValidAdminExportCursor,
  mapRpcExportItem,
  mapRpcPageResponse,
} from './hossiiExportApi';

const supabaseMock = vi.hoisted(() => ({
  configured: true,
  rpc: vi.fn(),
}));

vi.mock('../supabase', () => ({
  get isSupabaseConfigured() {
    return supabaseMock.configured;
  },
  supabase: {
    rpc: (name: string, args: unknown) => supabaseMock.rpc(name, args),
  },
}));

const sampleRpcItem = {
  hossii_id: 'h1',
  created_at: '2026-07-21T10:00:00+09:00',
  pane_name: 'Default',
  author_type: 'guest' as const,
  anonymous_id: 'abc123',
  message: 'hello',
  emotion: 'joy',
  hashtags: ['a', 'b'],
  number_value: 3,
  post_kind: 'bubble',
  has_image: false,
};

describe('hossiiExportApi helpers', () => {
  it('clamps export limit between 1 and max', () => {
    expect(clampAdminExportLimit(undefined)).toBe(200);
    expect(clampAdminExportLimit(0)).toBe(1);
    expect(clampAdminExportLimit(999)).toBe(ADMIN_EXPORT_MAX_LIMIT);
  });

  it('maps RPC item without optional keys', () => {
    expect(mapRpcExportItem(sampleRpcItem)).toEqual({
      hossiiId: 'h1',
      createdAt: '2026-07-21T10:00:00+09:00',
      paneName: 'Default',
      authorType: 'guest',
      anonymousId: 'abc123',
      message: 'hello',
      emotion: 'joy',
      hashtags: ['a', 'b'],
      numberValue: 3,
      postKind: 'bubble',
      hasImage: false,
    });
  });

  it('maps page response', () => {
    expect(
      mapRpcPageResponse({
        items: [sampleRpcItem],
        next_cursor: { created_at: '2026-07-21T09:00:00+09:00', id: 'h0' },
        has_more: true,
        page_count: 1,
      }),
    ).toEqual({
      items: [expect.objectContaining({ hossiiId: 'h1' })],
      nextCursor: { createdAt: '2026-07-21T09:00:00+09:00', id: 'h0' },
      hasMore: true,
      pageCount: 1,
    });
  });

  it('validates cursor shape', () => {
    expect(isValidAdminExportCursor({ createdAt: 't', id: '1' })).toBe(true);
    expect(isValidAdminExportCursor({ createdAt: 't' })).toBe(false);
    expect(isValidAdminExportCursor(null)).toBe(false);
  });
});

describe('fetchAdminExportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock.configured = true;
  });

  it('returns not configured when Supabase is unavailable', async () => {
    supabaseMock.configured = false;
    const result = await fetchAdminExportPage({ spaceId: 's1' });
    expect(result).toEqual({ ok: false, message: 'Supabase is not configured' });
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it('calls admin_export_space_hossiis_page with clamped args', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: {
        items: [sampleRpcItem],
        next_cursor: null,
        has_more: false,
        page_count: 1,
      },
      error: null,
    });

    const result = await fetchAdminExportPage({
      spaceId: 'dev-space-public',
      spacePaneId: 'pane-1',
      limit: 999,
      includeAuthorDisplayNames: true,
      includeImageUrls: false,
    });

    expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_export_space_hossiis_page', {
      p_space_id: 'dev-space-public',
      p_space_pane_id: 'pane-1',
      p_limit: ADMIN_EXPORT_MAX_LIMIT,
      p_include_author_display_names: true,
      p_include_image_urls: false,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items).toHaveLength(1);
      expect(result.data.hasMore).toBe(false);
    }
  });

  it('propagates RPC errors', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'not authorized', code: '42501' },
    });

    const result = await fetchAdminExportPage({ spaceId: 's1' });
    expect(result).toEqual({ ok: false, message: 'not authorized', code: '42501' });
  });
});

describe('fetchAllAdminExportHossiis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock.configured = true;
  });

  it('aggregates multiple pages and reports progress', async () => {
    supabaseMock.rpc
      .mockResolvedValueOnce({
        data: {
          items: [sampleRpcItem],
          next_cursor: { created_at: '2026-07-21T09:00:00+09:00', id: 'h0' },
          has_more: true,
          page_count: 1,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          items: [{ ...sampleRpcItem, hossii_id: 'h2' }],
          next_cursor: null,
          has_more: false,
          page_count: 1,
        },
        error: null,
      });

    const progress: number[] = [];
    const result = await fetchAllAdminExportHossiis({
      spaceId: 's1',
      onProgress: (p) => progress.push(p.fetchedCount),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.map((row) => row.hossiiId)).toEqual(['h1', 'h2']);
    }
    expect(progress).toEqual([1, 2]);
    expect(supabaseMock.rpc).toHaveBeenCalledTimes(2);
  });

  it('fails on partial page error', async () => {
    supabaseMock.rpc
      .mockResolvedValueOnce({
        data: {
          items: [sampleRpcItem],
          next_cursor: { created_at: '2026-07-21T09:00:00+09:00', id: 'h0' },
          has_more: true,
          page_count: 1,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'network', code: '500' },
      });

    const result = await fetchAllAdminExportHossiis({ spaceId: 's1' });
    expect(result).toEqual({
      ok: false,
      message: 'network',
      code: '500',
      partialCount: 1,
    });
  });

  it('stops on invalid next cursor', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: {
        items: [sampleRpcItem],
        next_cursor: { created_at: '2026-07-21T09:00:00+09:00', id: 'h0' },
        has_more: true,
        page_count: 1,
      },
      error: null,
    });
    supabaseMock.rpc.mockResolvedValueOnce({
      data: {
        items: [],
        next_cursor: null,
        has_more: true,
        page_count: 0,
      },
      error: null,
    });

    const result = await fetchAllAdminExportHossiis({ spaceId: 's1' });
    expect(result).toEqual({ ok: false, message: 'invalid next_cursor in export page response', partialCount: 1 });
  });

  it('stops on repeated cursor', async () => {
    const cursor = { created_at: '2026-07-21T09:00:00+09:00', id: 'h0' };
    supabaseMock.rpc
      .mockResolvedValueOnce({
        data: { items: [sampleRpcItem], next_cursor: cursor, has_more: true, page_count: 1 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { items: [sampleRpcItem], next_cursor: cursor, has_more: true, page_count: 1 },
        error: null,
      });

    const result = await fetchAllAdminExportHossiis({ spaceId: 's1' });
    expect(result).toEqual({ ok: false, message: 'repeated cursor detected', partialCount: 2 });
  });
});
