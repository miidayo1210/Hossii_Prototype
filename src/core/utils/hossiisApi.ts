import { supabase, isSupabaseConfigured } from '../supabase';
import type { Hossii } from '../types';

// Supabase の行型（snake_case）
type HossiiRow = {
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
};

// HossiiRow → Hossii（camelCase）
function rowToHossii(row: HossiiRow): Hossii {
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
  };
}

export async function fetchHossiis(spaceId: string): Promise<Hossii[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('hossiis')
    .select('*')
    .eq('space_id', spaceId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[hossiisApi] fetchHossiis error:', error.message);
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

export { rowToHossii };
export type { HossiiRow };
