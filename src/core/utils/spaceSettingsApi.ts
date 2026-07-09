import { supabase, isSupabaseConfigured } from '../supabase';
import type { SpaceSettings, SpaceModeId, SpaceModeSnapshot, SpaceModeState } from '../types/settings';
import {
  DEFAULT_SPACE_SETTINGS,
  DEFAULT_POSTING_SETTINGS,
  DEFAULT_REFLECTION_SETTINGS,
  DEFAULT_SPACE_MODE_STATE,
} from '../types/settings';
import { mergePostFieldSettings, parsePostFieldsFromJson, postFieldsToJson, resolvePostFields } from './postFieldSettings';

/** Legacy row shape（DROP 前の DB / テスト用） */
export type SupabaseSpaceSettingsRow = {
  space_id: string;
  space_name?: string;
  feature_message_post?: boolean | null;
  feature_comment_post?: boolean;
  feature_emotion_post?: boolean;
  feature_photo_post?: boolean;
  feature_number_post?: boolean;
  feature_likes_enabled?: boolean;
  card_type?: string;
  hossii_color?: string;
  bottle_frequency?: string;
  bubble_edit_permission?: string;
  post_fields?: unknown;
  posting_position_mode?: string | null;
  random_recall_enabled?: boolean | null;
  applied_mode?: string | null;
  mode_customized?: boolean | null;
  mode_applied_at?: string | null;
  mode_snapshot?: unknown;
  timeline_depth_enabled?: boolean | null;
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

function parsePostingMode(raw: string | null | undefined): SpaceSettings['posting'] {
  if (raw === 'selector' || raw === 'auto') {
    return { positionMode: raw };
  }
  return { ...DEFAULT_POSTING_SETTINGS };
}

function parseModeSnapshot(raw: unknown): SpaceModeSnapshot | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  const postFields = parsePostFieldsFromJson(obj.postFields);
  if (!postFields) return undefined;
  const positionMode = obj.positionMode;
  const bubbleEdit = obj.bubbleEditPermission;
  if (positionMode !== 'auto' && positionMode !== 'selector') return undefined;
  if (bubbleEdit !== 'all' && bubbleEdit !== 'owner_and_admin') return undefined;
  return {
    isPrivate: obj.isPrivate === true,
    likesEnabled: obj.likesEnabled !== false,
    positionMode,
    randomRecallEnabled: obj.randomRecallEnabled === true,
    bubbleEditPermission: bubbleEdit,
    postFields,
  };
}

const VALID_MODE_IDS: SpaceModeId[] = ['plaza', 'reflection', 'workshop', 'event', 'custom'];

function parseModeState(row: SupabaseSpaceSettingsRow): SpaceModeState | undefined {
  const appliedMode = row.applied_mode;
  if (!appliedMode || !VALID_MODE_IDS.includes(appliedMode as SpaceModeId)) {
    return undefined;
  }
  return {
    appliedMode: appliedMode as SpaceModeId,
    isCustomized: row.mode_customized ?? false,
    appliedAt: row.mode_applied_at ?? undefined,
    snapshot: parseModeSnapshot(row.mode_snapshot),
  };
}

function modeSnapshotToJson(snapshot: SpaceModeSnapshot): Record<string, unknown> {
  return {
    isPrivate: snapshot.isPrivate,
    likesEnabled: snapshot.likesEnabled,
    positionMode: snapshot.positionMode,
    randomRecallEnabled: snapshot.randomRecallEnabled,
    bubbleEditPermission: snapshot.bubbleEditPermission,
    postFields: postFieldsToJson(snapshot.postFields),
  };
}

function parseLegacyFeatures(row: SupabaseSpaceSettingsRow): SpaceSettings['features'] {
  const hasLegacy =
    row.feature_message_post !== undefined ||
    row.feature_comment_post !== undefined ||
    row.feature_emotion_post !== undefined ||
    row.feature_photo_post !== undefined ||
    row.feature_number_post !== undefined;

  if (!hasLegacy) {
    return { likesEnabled: row.feature_likes_enabled ?? true };
  }

  return {
    messagePost: row.feature_message_post ?? row.feature_comment_post,
    emotionPost: row.feature_emotion_post,
    photoPost: row.feature_photo_post,
    numberPost: row.feature_number_post,
    likesEnabled: row.feature_likes_enabled ?? true,
  };
}

function toSpaceSettings(row: SupabaseSpaceSettingsRow, spaceName: string): SpaceSettings {
  const postFields = parsePostFieldsFromJson(row.post_fields);
  const posting = parsePostingMode(row.posting_position_mode);
  const reflection = {
    randomRecallEnabled: row.random_recall_enabled ?? DEFAULT_REFLECTION_SETTINGS.randomRecallEnabled,
  };
  const mode = parseModeState(row);
  return {
    spaceId: row.space_id,
    spaceName: row.space_name ?? spaceName,
    features: parseLegacyFeatures(row),
    bubbleEditPermission: (row.bubble_edit_permission ?? 'all') as SpaceSettings['bubbleEditPermission'],
    bottleFrequency: (row.bottle_frequency ?? '3d-7d') as SpaceSettings['bottleFrequency'],
    ...(postFields ? { postFields } : {}),
    posting,
    reflection,
    ...(mode ? { mode } : {}),
    timelineDepthEnabled: row.timeline_depth_enabled === true,
  };
}

/** @internal tests */
export function parseSpaceSettingsRow(
  row: SupabaseSpaceSettingsRow,
  spaceName: string,
): SpaceSettings {
  return toSpaceSettings(row, spaceName);
}

function toBaseRow(settings: SpaceSettings): Record<string, unknown> {
  return {
    space_id: settings.spaceId,
    feature_likes_enabled: settings.features.likesEnabled,
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

  const settings = toSpaceSettings(data as SupabaseSpaceSettingsRow, spaceName);

  if (!settings.postFields) {
    const withFields = {
      ...settings,
      spaceName,
      postFields: resolvePostFields(settings),
    };
    upsertSpaceSettings(withFields).catch((err) => {
      console.error('[spaceSettingsApi] post_fields backfill failed', err);
    });
    return withFields;
  }

  return { ...settings, spaceName };
}

/** @internal tests */
export function timelineDepthEnabledToDbColumn(enabled: boolean): { timeline_depth_enabled: boolean } {
  return { timeline_depth_enabled: enabled };
}

export async function updateTimelineDepthEnabled(
  spaceId: string,
  enabled: boolean,
): Promise<void> {
  if (!isSupabaseConfigured) return;

  const payload = timelineDepthEnabledToDbColumn(enabled);

  const { data: existing, error: selectError } = await supabase
    .from('space_settings')
    .select('space_id')
    .eq('space_id', spaceId)
    .maybeSingle();

  if (selectError) {
    console.error('[spaceSettingsApi] updateTimelineDepthEnabled select error:', selectError);
    throw selectError;
  }

  if (existing) {
    const { error } = await supabase
      .from('space_settings')
      .update(payload)
      .eq('space_id', spaceId);

    if (error) {
      if (isMissingColumnError(error, 'timeline_depth_enabled')) {
        console.error('[spaceSettingsApi] updateTimelineDepthEnabled column missing:', error);
      } else {
        console.error('[spaceSettingsApi] updateTimelineDepthEnabled update error:', error);
      }
      throw error;
    }
    return;
  }

  const { error: insertError } = await supabase
    .from('space_settings')
    .insert({ space_id: spaceId, ...payload });

  if (insertError) {
    if (isMissingColumnError(insertError, 'timeline_depth_enabled')) {
      console.error('[spaceSettingsApi] updateTimelineDepthEnabled column missing:', insertError);
    } else {
      console.error('[spaceSettingsApi] updateTimelineDepthEnabled insert error:', insertError);
    }
    throw insertError;
  }
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

  const postingMode = settings.posting?.positionMode ?? DEFAULT_POSTING_SETTINGS.positionMode;
  const { error: postingError } = await supabase
    .from('space_settings')
    .update({ posting_position_mode: postingMode })
    .eq('space_id', settings.spaceId);

  if (postingError && !isMissingColumnError(postingError, 'posting_position_mode')) {
    console.error('[spaceSettingsApi] upsertSpaceSettings posting_position_mode error:', postingError);
    throw postingError;
  }

  const randomRecall = settings.reflection?.randomRecallEnabled ?? DEFAULT_REFLECTION_SETTINGS.randomRecallEnabled;
  const { error: recallError } = await supabase
    .from('space_settings')
    .update({ random_recall_enabled: randomRecall })
    .eq('space_id', settings.spaceId);

  if (recallError && !isMissingColumnError(recallError, 'random_recall_enabled')) {
    console.error('[spaceSettingsApi] upsertSpaceSettings random_recall_enabled error:', recallError);
    throw recallError;
  }

  const mode = settings.mode ?? DEFAULT_SPACE_MODE_STATE;
  const modeUpdate: Record<string, unknown> = {
    applied_mode: mode.appliedMode,
    mode_customized: mode.isCustomized,
    mode_applied_at: mode.appliedAt ?? null,
    mode_snapshot: mode.snapshot ? modeSnapshotToJson(mode.snapshot) : null,
  };
  const { error: modeError } = await supabase
    .from('space_settings')
    .update(modeUpdate)
    .eq('space_id', settings.spaceId);

  if (modeError && !isMissingColumnError(modeError, 'applied_mode')) {
    console.error('[spaceSettingsApi] upsertSpaceSettings mode error:', modeError);
    throw modeError;
  }
}
