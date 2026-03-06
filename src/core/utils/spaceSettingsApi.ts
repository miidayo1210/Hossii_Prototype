import { supabase, isSupabaseConfigured } from '../supabase';
import type { SpaceSettings } from '../types/settings';
import { DEFAULT_SPACE_SETTINGS } from '../types/settings';

type SupabaseSpaceSettings = {
  space_id: string;
  space_name: string;
  feature_comment_post: boolean;
  feature_emotion_post: boolean;
  feature_photo_post: boolean;
  feature_number_post: boolean;
  card_type: string;
  hossii_color: string;
  bubble_edit_permission: string;
};

function toSpaceSettings(row: SupabaseSpaceSettings): SpaceSettings {
  return {
    spaceId: row.space_id,
    spaceName: row.space_name,
    features: {
      commentPost: row.feature_comment_post,
      emotionPost: row.feature_emotion_post,
      photoPost: row.feature_photo_post,
      numberPost: row.feature_number_post,
    },
    cardType: row.card_type as SpaceSettings['cardType'],
    hossiiColor: row.hossii_color as SpaceSettings['hossiiColor'],
    bubbleEditPermission: (row.bubble_edit_permission ?? 'all') as SpaceSettings['bubbleEditPermission'],
  };
}

function toRow(settings: SpaceSettings): SupabaseSpaceSettings {
  return {
    space_id: settings.spaceId,
    space_name: settings.spaceName,
    feature_comment_post: settings.features.commentPost,
    feature_emotion_post: settings.features.emotionPost,
    feature_photo_post: settings.features.photoPost,
    feature_number_post: settings.features.numberPost,
    card_type: settings.cardType,
    hossii_color: settings.hossiiColor,
    bubble_edit_permission: settings.bubbleEditPermission ?? 'all',
  };
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

  return toSpaceSettings(data as SupabaseSpaceSettings);
}

export async function upsertSpaceSettings(settings: SpaceSettings): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase
    .from('space_settings')
    .upsert(toRow(settings), { onConflict: 'space_id' });

  if (error) {
    console.error('[spaceSettingsApi] upsertSpaceSettings error:', error);
  }
}
