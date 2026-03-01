import { supabase, isSupabaseConfigured } from '../supabase';
import type { Hossii } from '../types';

// Supabase の行型（snake_case）
export type HossiiRow = {
  id: string;
  message: string;
  emotion: string | null;
  space_id: string;
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
};

// HossiiRow → Hossii（camelCase）
export function rowToHossii(row: HossiiRow): Hossii {
  return {
    id: row.id,
    message: row.message,
    emotion: row.emotion as Hossii['emotion'] ?? undefined,
    spaceId: row.space_id,
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
    imageUrl: row.image_url ?? undefined,
    positionX: row.position_x ?? undefined,
    positionY: row.position_y ?? undefined,
    isPositionFixed: row.is_position_fixed ?? false,
    scale: row.scale ?? 1.0,
    isHidden: row.is_hidden ?? false,
    hiddenAt: row.hidden_at ? new Date(row.hidden_at) : undefined,
    hiddenBy: row.hidden_by ?? undefined,
    numberValue: row.number_value ?? undefined,
  };
}

// Hossii（camelCase）→ INSERT 用オブジェクト（snake_case）
function hossiiToRow(hossii: Hossii): Omit<HossiiRow, 'created_at'> & { created_at: string } {
  return {
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
    image_url: hossii.imageUrl ?? null,
    position_x: hossii.positionX ?? null,
    position_y: hossii.positionY ?? null,
    is_position_fixed: hossii.isPositionFixed ?? false,
    scale: hossii.scale ?? 1.0,
    is_hidden: hossii.isHidden ?? false,
    hidden_at: hossii.hiddenAt?.toISOString() ?? null,
    hidden_by: hossii.hiddenBy ?? null,
    number_value: hossii.numberValue ?? null,
  };
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

export async function insertHossii(hossii: Hossii): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase.from('hossiis').insert(hossiiToRow(hossii));
  if (error) {
    console.error('[hossiisApi] insertHossii error:', error.message);
  }
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

  const { error } = await supabase
    .from('hossiis')
    .update({ position_x: positionX, position_y: positionY, is_position_fixed: true })
    .eq('id', id);
  if (error) {
    console.error('[hossiisApi] updateHossiiPosition error:', error.message);
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
