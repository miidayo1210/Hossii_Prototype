import { supabase, isSupabaseConfigured } from '../supabase';
import type { Hossii } from '../types';
import { buildKeysetOrFilter, sortHossiisNewestFirst, type HossiiPageCursor } from './hossiiFetchPage';

// Supabase の行型（snake_case）
export type HossiiRow = {
  id: string;
  message: string;
  emotion: string | null;
  space_id: string;
  space_pane_id?: string | null;
  author_id: string | null;
  author_name: string | null;
  origin: string;
  auto_type: string | null;
  speech_level: string | null;
  language: string | null;
  log_type: string | null;
  created_at: string;
  // F01
  bubble_color: string | null;
  // F09
  hashtags: string[] | null;
  // T02: プリセットタグ
  tags: string[] | null;
  // F10
  image_url: string | null;
  // F02/F04
  position_x: number | null;
  position_y: number | null;
  is_position_fixed: boolean | null;
  // F05
  scale: number | null;
  // F06
  is_hidden: boolean | null;
  hidden_at: string | null;
  hidden_by: string | null;
  // numberPost
  number_value: number | null;
  // いいね
  like_count: number;
  /** マイグレーション前の行では欠ける場合あり（bubble 扱い） */
  post_kind?: string | null;
  // Phase 2D-1: 公開範囲 / ソフト削除 / 本文編集（古い行や mock では欠ける場合あり）
  visibility?: string | null;
  deleted_at?: string | null;
  content_edited_at?: string | null;
};

/** INSERT 用。post_kind は未マイグレーション環境があるため含めない */
export type HossiiInsertRow = Omit<HossiiRow, 'created_at' | 'post_kind'> & {
  created_at: string;
  space_pane_id?: string | null;
};

/**
 * is_hidden を厳密に boolean へ（PostgREST / 型ゆれで string や数値が来る場合がある）
 * 文字列 "false" は truthy なので、素の `!h.isHidden` だと一覧から全件消えることがある。
 */
/** DB に post_kind 列が無い環境向け: キャンバス画像のストレージパスで推定 */
function inferPostKindFromRow(row: HossiiRow): Hossii['postKind'] {
  if (row.post_kind === 'canvas') return 'canvas';
  if (row.post_kind === 'bubble') return 'bubble';
  const url = row.image_url ?? '';
  if (url.includes('/canvas/') || url.includes('canvas%2F')) return 'canvas';
  return 'bubble';
}

/** visibility を厳密に 'public' | 'owner_only' へ。欠損/不正値は 'public'（後方互換） */
export function coerceVisibility(value: unknown): Hossii['visibility'] {
  return value === 'owner_only' ? 'owner_only' : 'public';
}

export function coerceIsHidden(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value == null) return false;
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase();
    return s === 'true' || s === '1' || s === 't' || s === 'yes';
  }
  return false;
}

// HossiiRow → Hossii（camelCase）
export function rowToHossii(row: HossiiRow): Hossii {
  return {
    id: row.id,
    message: row.message,
    emotion: row.emotion as Hossii['emotion'] ?? undefined,
    spaceId: row.space_id,
    spacePaneId: row.space_pane_id ?? undefined,
    authorId: row.author_id ?? undefined,
    authorName: row.author_name ?? undefined,
    origin: row.origin as Hossii['origin'],
    autoType: row.auto_type as Hossii['autoType'] ?? undefined,
    speechLevel: row.speech_level as Hossii['speechLevel'] ?? undefined,
    language: row.language as Hossii['language'] ?? undefined,
    logType: row.log_type as Hossii['logType'] ?? undefined,
    createdAt: new Date(row.created_at),
    bubbleColor: row.bubble_color ?? undefined,
    hashtags: row.hashtags ?? undefined,
    tags: row.tags ?? undefined,
    imageUrl: row.image_url ?? undefined,
    positionX: row.position_x ?? undefined,
    positionY: row.position_y ?? undefined,
    isPositionFixed: row.is_position_fixed ?? false,
    scale: row.scale ?? 1.0,
    isHidden: coerceIsHidden(row.is_hidden),
    hiddenAt: row.hidden_at ? new Date(row.hidden_at) : undefined,
    hiddenBy: row.hidden_by ?? undefined,
    numberValue: row.number_value ?? undefined,
    likeCount: row.like_count ?? 0,
    postKind: inferPostKindFromRow(row),
    visibility: coerceVisibility(row.visibility),
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
    contentEditedAt: row.content_edited_at ? new Date(row.content_edited_at) : null,
  };
}

// Hossii（camelCase）→ INSERT 用オブジェクト（snake_case）
// post_kind は未マイグレーションの DB に列が無いと 400 になるため送らない（キャンバスは image_url パスで復元）
function hossiiToInsertRow(hossii: Hossii): HossiiInsertRow {
  const row: HossiiInsertRow = {
    id: hossii.id,
    message: hossii.message,
    emotion: hossii.emotion ?? null,
    space_id: hossii.spaceId,
    author_id: hossii.authorId ?? null,
    author_name: hossii.authorName ?? null,
    origin: hossii.origin ?? 'manual',
    auto_type: hossii.autoType ?? null,
    speech_level: hossii.speechLevel ?? null,
    language: hossii.language ?? null,
    log_type: hossii.logType ?? null,
    created_at: hossii.createdAt.toISOString(),
    bubble_color: hossii.bubbleColor ?? null,
    hashtags: hossii.hashtags ?? null,
    tags: hossii.tags ?? null,
    image_url: hossii.imageUrl ?? null,
    position_x: hossii.positionX ?? null,
    position_y: hossii.positionY ?? null,
    is_position_fixed: hossii.isPositionFixed ?? false,
    scale: hossii.scale ?? 1.0,
    is_hidden: hossii.isHidden ?? false,
    hidden_at: hossii.hiddenAt?.toISOString() ?? null,
    hidden_by: hossii.hiddenBy ?? null,
    number_value: hossii.numberValue ?? null,
    like_count: hossii.likeCount ?? 0,
  };

  if (hossii.spacePaneId != null) {
    row.space_pane_id = hossii.spacePaneId;
  }

  return row;
}

/** Exported for Phase 1 insert-payload regression tests. */
export function buildHossiiInsertPayload(hossii: Hossii): HossiiInsertRow {
  return hossiiToInsertRow(hossii);
}

export async function fetchHossiis(spaceId: string): Promise<Hossii[]> {
  if (!isSupabaseConfigured) return [];

  // is_hidden = false または NULL の投稿のみ取得（非表示投稿をクライアントに送らない）
  const { data, error } = await supabase
    .from('hossiis')
    .select('*')
    .eq('space_id', spaceId)
    .or('is_hidden.eq.false,is_hidden.is.null')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[hossiisApi] fetchHossiis error:', error.message);
    return [];
  }

  return (data as HossiiRow[]).map(rowToHossii);
}

export type FetchHossiisPageParams = {
  spaceId: string;
  limit: number;
  cursor?: HossiiPageCursor;
  periodCutoff?: Date | null;
  upperBound?: string | null;
  signal?: AbortSignal;
  paneFilter?: PaneFetchScope;
};

export type PaneFetchScope =
  | { kind: 'default'; defaultPaneId: string }
  | { kind: 'pane'; paneId: string }
  | { kind: 'all-panes' };

/** PostgREST filter for default pane (Phase 10B: explicit default pane id only). */
export function buildDefaultPaneFetchOrFilter(defaultPaneId: string): string {
  return `space_pane_id.eq.${defaultPaneId}`;
}

/** Client-side pane filter (tests / demo validation). */
export function matchesPaneFetchScope(
  hossii: Pick<Hossii, 'spacePaneId'>,
  scope: PaneFetchScope,
): boolean {
  if (scope.kind === 'all-panes') return true;
  if (scope.kind === 'default') {
    return hossii.spacePaneId === scope.defaultPaneId;
  }
  return hossii.spacePaneId === scope.paneId;
}

export type FetchHossiisPageResult = {
  items: Hossii[];
  nextCursor: HossiiPageCursor | null;
  hasMore: boolean;
};

export async function fetchHossiisPage(
  params: FetchHossiisPageParams,
): Promise<FetchHossiisPageResult> {
  if (!isSupabaseConfigured) {
    return { items: [], nextCursor: null, hasMore: false };
  }

  const { spaceId, limit, cursor, periodCutoff, upperBound, signal, paneFilter } = params;

  let query = supabase
    .from('hossiis')
    .select('*')
    .eq('space_id', spaceId)
    .or('is_hidden.eq.false,is_hidden.is.null')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);

  if (paneFilter?.kind === 'default') {
    query = query.eq('space_pane_id', paneFilter.defaultPaneId);
  } else if (paneFilter?.kind === 'pane') {
    query = query.eq('space_pane_id', paneFilter.paneId);
  }

  if (periodCutoff) {
    query = query.gte('created_at', periodCutoff.toISOString());
  }
  if (upperBound) {
    query = query.lte('created_at', upperBound);
  }
  if (cursor) {
    query = query.or(buildKeysetOrFilter(cursor));
  }

  if (signal) {
    query = query.abortSignal(signal);
  }

  const { data, error } = await query;

  if (error) {
    if (error.message?.includes('AbortError') || error.name === 'AbortError') {
      return { items: [], nextCursor: null, hasMore: false };
    }
    console.error('[hossiisApi] fetchHossiisPage error:', error.message);
    return { items: [], nextCursor: null, hasMore: false };
  }

  const items = sortHossiisNewestFirst((data as HossiiRow[]).map(rowToHossii));
  const oldest = items[items.length - 1];
  const nextCursor =
    items.length > 0
      ? { createdAt: oldest.createdAt.toISOString(), id: oldest.id }
      : null;
  const hasMore = items.length === limit;

  return { items, nextCursor, hasMore };
}

/** 非表示を含む全投稿を取得（モデレーション画面専用） */
export async function fetchAllHossiisForModeration(spaceId: string): Promise<Hossii[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('hossiis')
    .select('*')
    .eq('space_id', spaceId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[hossiisApi] fetchAllHossiisForModeration error:', error.message);
    return [];
  }

  return (data as HossiiRow[]).map(rowToHossii);
}

export type InsertHossiiResult =
  | { ok: true }
  | { ok: false; message: string; code?: string };

export async function insertHossii(hossii: Hossii): Promise<InsertHossiiResult> {
  if (!isSupabaseConfigured) return { ok: false, message: 'Supabase is not configured' };

  const { error } = await supabase.from('hossiis').insert(hossiiToInsertRow(hossii));
  if (error) {
    console.error('[hossiisApi] insertHossii error:', error.message);
    return { ok: false, message: error.message, code: error.code };
  }
  return { ok: true };
}

export async function updateHossiiColor(id: string, color: string | null): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase
    .from('hossiis')
    .update({ bubble_color: color })
    .eq('id', id);
  if (error) {
    console.error('[hossiisApi] updateHossiiColor error:', error.message);
  }
}

export async function updateHossiiPosition(
  id: string,
  positionX: number,
  positionY: number
): Promise<void> {
  if (!isSupabaseConfigured) return;

  const doUpdate = () =>
    supabase
      .from('hossiis')
      .update({ position_x: positionX, position_y: positionY, is_position_fixed: true })
      .eq('id', id);

  const { error } = await doUpdate();
  if (error) {
    const { error: retryError } = await doUpdate();
    if (retryError) {
      console.warn('[hossiisApi] updateHossiiPosition retry failed:', retryError.message);
    }
  }
}

export async function updateHossiiScale(id: string, scale: number): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase
    .from('hossiis')
    .update({ scale })
    .eq('id', id);
  if (error) {
    console.error('[hossiisApi] updateHossiiScale error:', error.message);
  }
}

/** Move hossii to another pane in the same space (Phase 10C). */
export async function updateHossiiPaneId(
  hossiiId: string,
  spaceId: string,
  targetPaneId: string,
): Promise<boolean> {
  if (!isSupabaseConfigured) return true;

  const { error } = await supabase
    .from('hossiis')
    .update({ space_pane_id: targetPaneId })
    .eq('id', hossiiId)
    .eq('space_id', spaceId);

  if (error) {
    console.error('[hossiisApi] updateHossiiPaneId error:', error.message);
    return false;
  }
  return true;
}

export async function hideHossiiInDb(id: string, adminId?: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase
    .from('hossiis')
    .update({ is_hidden: true, hidden_at: new Date().toISOString(), hidden_by: adminId ?? null })
    .eq('id', id);
  if (error) {
    console.error('[hossiisApi] hideHossiiInDb error:', error.message);
  }
}

export async function restoreHossiiInDb(id: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase
    .from('hossiis')
    .update({ is_hidden: false, hidden_at: null, hidden_by: null })
    .eq('id', id);
  if (error) {
    console.error('[hossiisApi] restoreHossiiInDb error:', error.message);
  }
}

export async function deleteHossiiFromDb(id: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase.from('hossiis').delete().eq('id', id);
  if (error) {
    console.error('[hossiisApi] deleteHossiiFromDb error:', error.message);
  }
}

export async function deleteAllHossiisInSpace(spaceId: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase.from('hossiis').delete().eq('space_id', spaceId);
  if (error) {
    console.error('[hossiisApi] deleteAllHossiisInSpace error:', error.message);
  }
}
