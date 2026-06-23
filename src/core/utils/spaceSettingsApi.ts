import { supabase, isSupabaseConfigured } from '../supabase';
import type { SpaceSettings } from '../types/settings';
import { DEFAULT_SPACE_SETTINGS } from '../types/settings';
import { mergePostFieldSettings, parsePostFieldsFromJson, postFieldsToJson } from './postFieldSettings';

type SupabaseSpaceSettingsRow = {
  space_id: string;
  space_name: string;
  feature_comment_post: boolean;
  feature_emotion_post: boolean;
  feature_photo_post: boolean;
  feature_number_post: boolean;
  feature_likes_enabled: boolean;
  card_type: string;
  hossii_color: string;
  bottle_frequency: string;
  bubble_edit_permission?: string;
  post_fields?: unknown;
};

function isMissingColumnError(error: { code?: string; message?: string }, column: string): boolean {
  const msg = (error.message ?? '').toLowerCase();
  const col = column.toLowerCase();
  return (
    error.code === 'PGRST204' ||
    error.code === '42703' ||
    (msg.includes(col) && msg.includes('column')) ||
    msg.includes('schema cache')
  );
}

function toSpaceSettings(row: SupabaseSpaceSettingsRow): SpaceSettings {
  const postFields = parsePostFieldsFromJson(row.post_fields);
  return {
    spaceId: row.space_id,
    spaceName: row.space_name,
    features: {
      commentPost: row.feature_comment_post,
      emotionPost: row.feature_emotion_post,
      photoPost: row.feature_photo_post,
      numberPost: row.feature_number_post,
      likesEnabled: row.feature_likes_enabled ?? true,
    },
    cardType: row.card_type as SpaceSettings['cardType'],
    hossiiColor: row.hossii_color as SpaceSettings['hossiiColor'],
    bubbleEditPermission: (row.bubble_edit_permission ?? 'all') as SpaceSettings['bubbleEditPermission'],
    bottleFrequency: (row.bottle_frequency ?? '3d-7d') as SpaceSettings['bottleFrequency'],
    ...(postFields ? { postFields } : {}),
  };
}

/** Supabase に確実に存在する列のみ（未知列で upsert 全体が失敗するのを防ぐ） */
function toBaseRow(settings: SpaceSettings): SupabaseSpaceSettingsRow {
  return {
    space_id: settings.spaceId,
    space_name: settings.spaceName,
    feature_comment_post: settings.features.commentPost,
    feature_emotion_post: settings.features.emotionPost,
    feature_photo_post: settings.features.photoPost,
    feature_number_post: settings.features.numberPost,
    feature_likes_enabled: settings.features.likesEnabled,
    card_type: settings.cardType,
    hossii_color: settings.hossiiColor,
    bottle_frequency: settings.bottleFrequency ?? '3d-7d',
  };
}

export class PostFieldsColumnMissingError extends Error {
  constructor() {
    super('post_fields column missing');
    this.name = 'PostFieldsColumnMissingError';
  }
}

export async function fetchSpaceSettings(
  spaceId: string,
  spaceName: string
): Promise<SpaceSettings> {
  if (!isSupabaseConfigured) {
    return { spaceId, spaceName, ...DEFAULT_SPACE_SETTINGS };
  }

  const { data, error } = await supabase
    .from('space_settings')
    .select('*')
    .eq('space_id', spaceId)
    .maybeSingle();

  if (error) {
    console.error('[spaceSettingsApi] fetchSpaceSettings error:', error);
    return { spaceId, spaceName, ...DEFAULT_SPACE_SETTINGS };
  }

  if (!data) {
    return { spaceId, spaceName, ...DEFAULT_SPACE_SETTINGS };
  }

  return toSpaceSettings(data as SupabaseSpaceSettingsRow);
}

export async function upsertSpaceSettings(settings: SpaceSettings): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { error: baseError } = await supabase
    .from('space_settings')
    .upsert(toBaseRow(settings), { onConflict: 'space_id' });

  if (baseError) {
    console.error('[spaceSettingsApi] upsertSpaceSettings base error:', baseError);
    throw baseError;
  }

  const bubbleEdit = settings.bubbleEditPermission ?? 'all';
  const { error: permError } = await supabase
    .from('space_settings')
    .update({ bubble_edit_permission: bubbleEdit })
    .eq('space_id', settings.spaceId);

  if (permError && !isMissingColumnError(permError, 'bubble_edit_permission')) {
    console.error('[spaceSettingsApi] upsertSpaceSettings bubble_edit_permission error:', permError);
    throw permError;
  }

  const postFields = mergePostFieldSettings(settings.postFields);
  const { error: fieldsError } = await supabase
    .from('space_settings')
    .update({ post_fields: postFieldsToJson(postFields) })
    .eq('space_id', settings.spaceId);

  if (fieldsError) {
    if (isMissingColumnError(fieldsError, 'post_fields')) {
      throw new PostFieldsColumnMissingError();
    }
    console.error('[spaceSettingsApi] upsertSpaceSettings post_fields error:', fieldsError);
    throw fieldsError;
  }
}
