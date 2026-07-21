import { supabase, isSupabaseConfigured } from '../supabase';
import type {
  AdminExportCursor,
  AdminExportFetchAllOptions,
  AdminExportFetchPageOptions,
  AdminExportHossiiItem,
  AdminExportPageResult,
  AdminExportProgress,
  AdminExportResult,
  HossiiAuthorType,
} from './hossiiExportTypes';

export const ADMIN_EXPORT_DEFAULT_LIMIT = 200;
export const ADMIN_EXPORT_MAX_LIMIT = 500;
export const ADMIN_EXPORT_MAX_PAGES = 500;

export const ADMIN_EXPORT_AUTHOR_TYPES = ['guest', 'account', 'participant_account'] as const;

export function isValidAdminExportAuthorType(value: unknown): value is HossiiAuthorType {
  return (
    typeof value === 'string' &&
    (ADMIN_EXPORT_AUTHOR_TYPES as readonly string[]).includes(value)
  );
}

type RpcExportItem = {
  hossii_id: string;
  created_at: string;
  pane_name: string;
  author_type: HossiiAuthorType;
  anonymous_id: string;
  message: string | null;
  emotion: string | null;
  hashtags: string[] | null;
  number_value: number | null;
  post_kind: string | null;
  has_image: boolean;
  author_display_name?: string;
  image_url?: string;
};

type RpcPageResponse = {
  items: RpcExportItem[] | null;
  next_cursor: { created_at: string; id: string } | null;
  has_more: boolean;
  page_count: number;
};

export function clampAdminExportLimit(limit?: number): number {
  const raw = limit ?? ADMIN_EXPORT_DEFAULT_LIMIT;
  return Math.min(Math.max(raw, 1), ADMIN_EXPORT_MAX_LIMIT);
}

export function isValidAdminExportCursor(value: unknown): value is AdminExportCursor {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.createdAt === 'string' && typeof row.id === 'string';
}

function mapRpcCursor(cursor: RpcPageResponse['next_cursor']): AdminExportCursor | null {
  if (!cursor || typeof cursor.created_at !== 'string' || typeof cursor.id !== 'string') {
    return null;
  }
  return { createdAt: cursor.created_at, id: cursor.id };
}

export function mapRpcExportItem(row: RpcExportItem): AdminExportHossiiItem | null {
  if (!isValidAdminExportAuthorType(row.author_type)) {
    return null;
  }
  const item: AdminExportHossiiItem = {
    hossiiId: row.hossii_id,
    createdAt: row.created_at,
    paneName: row.pane_name ?? '',
    authorType: row.author_type,
    anonymousId: row.anonymous_id,
    message: row.message,
    emotion: row.emotion,
    hashtags: Array.isArray(row.hashtags) ? row.hashtags : [],
    numberValue: row.number_value,
    postKind: row.post_kind ?? 'bubble',
    hasImage: row.has_image === true,
  };
  if (typeof row.author_display_name === 'string') {
    item.authorDisplayName = row.author_display_name;
  }
  if (typeof row.image_url === 'string') {
    item.imageUrl = row.image_url;
  }
  return item;
}

export function mapRpcPageResponse(data: unknown): AdminExportPageResult | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as RpcPageResponse;
  if (!Array.isArray(row.items) && row.items !== null && row.items !== undefined) return null;
  if (typeof row.has_more !== 'boolean' || typeof row.page_count !== 'number') return null;

  const items = (row.items ?? [])
    .map(mapRpcExportItem)
    .filter((item): item is AdminExportHossiiItem => item !== null);
  if ((row.items ?? []).length !== items.length) {
    return null;
  }

  return {
    items,
    nextCursor: mapRpcCursor(row.next_cursor),
    hasMore: row.has_more,
    pageCount: row.page_count,
  };
}

function cursorKey(cursor: AdminExportCursor): string {
  return `${cursor.createdAt}\0${cursor.id}`;
}

export async function fetchAdminExportPage(
  options: AdminExportFetchPageOptions,
): Promise<AdminExportResult<AdminExportPageResult>> {
  if (!isSupabaseConfigured) {
    return { ok: false, message: 'Supabase is not configured' };
  }
  if (!options.spaceId) {
    return { ok: false, message: 'space id is required' };
  }
  if (options.signal?.aborted) {
    return { ok: false, message: 'aborted' };
  }

  const args: Record<string, unknown> = {
    p_space_id: options.spaceId,
    p_limit: clampAdminExportLimit(options.limit),
    p_include_author_display_names: options.includeAuthorDisplayNames === true,
    p_include_image_urls: options.includeImageUrls === true,
  };
  if (options.spacePaneId) {
    args.p_space_pane_id = options.spacePaneId;
  }
  if (options.cursor) {
    args.p_cursor_created_at = options.cursor.createdAt;
    args.p_cursor_id = options.cursor.id;
  }

  const { data, error } = await supabase.rpc('admin_export_space_hossiis_page', args);

  if (options.signal?.aborted) {
    return { ok: false, message: 'aborted' };
  }
  if (error) {
    return { ok: false, message: error.message, code: error.code };
  }

  const mapped = mapRpcPageResponse(data);
  if (!mapped) {
    return { ok: false, message: 'invalid export page response' };
  }

  if (mapped.hasMore && !mapped.nextCursor) {
    return { ok: false, message: 'invalid next_cursor in export page response' };
  }

  return { ok: true, data: mapped };
}

export async function fetchAllAdminExportHossiis(
  options: AdminExportFetchAllOptions,
): Promise<AdminExportResult<AdminExportHossiiItem[]>> {
  const allItems: AdminExportHossiiItem[] = [];
  const seenCursors = new Set<string>();
  let cursor: AdminExportCursor | null = null;
  let pageCount = 0;

  while (true) {
    if (options.signal?.aborted) {
      return { ok: false, message: 'aborted', partialCount: allItems.length };
    }
    if (pageCount >= ADMIN_EXPORT_MAX_PAGES) {
      return {
        ok: false,
        message: 'export page limit exceeded',
        partialCount: allItems.length,
      };
    }

    const pageResult = await fetchAdminExportPage({
      ...options,
      cursor,
    });

    if (!pageResult.ok) {
      return {
        ok: false,
        message: pageResult.message,
        code: pageResult.code,
        partialCount: allItems.length,
      };
    }

    allItems.push(...pageResult.data.items);
    pageCount += 1;
    options.onProgress?.({
      fetchedCount: allItems.length,
      pageCount,
    } satisfies AdminExportProgress);

    if (!pageResult.data.hasMore) {
      return { ok: true, data: allItems };
    }

    const nextCursor = pageResult.data.nextCursor;
    if (!isValidAdminExportCursor(nextCursor)) {
      return {
        ok: false,
        message: 'invalid next_cursor',
        partialCount: allItems.length,
      };
    }

    const key = cursorKey(nextCursor);
    if (seenCursors.has(key)) {
      return {
        ok: false,
        message: 'repeated cursor detected',
        partialCount: allItems.length,
      };
    }
    seenCursors.add(key);
    cursor = nextCursor;
  }
}
