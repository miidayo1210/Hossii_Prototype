import { supabase, isSupabaseConfigured } from '../supabase';
import type { Hossii } from '../types';
import type {
  CreateSpacePaneInput,
  SpacePane,
  SpacePaneSettingsOverride,
  UpdateSpacePanePatch,
} from '../types/spacePane';
import type { CustomEmotion, SpaceBackground, SpaceDecoration } from '../types/space';
import { parseCustomEmotionsFromJson, parseDecorationsFromJson } from './spaceDecorations';

export type SpacePaneRow = {
  id: string;
  space_id: string;
  name: string;
  slug: string;
  sort_order: number;
  is_default: boolean;
  is_visible: boolean;
  background: unknown;
  saved_background_images: string[] | null;
  decorations: unknown;
  character_image_url: string | null;
  character_name: string | null;
  custom_emotions: unknown;
  bubble_shape_png: string | null;
  settings: unknown;
  created_at: string;
  updated_at: string;
};

export function defaultSpacePaneId(spaceId: string): string {
  return `${spaceId}-pane-default`;
}

function parseSettingsOverride(raw: unknown): SpacePaneSettingsOverride | null {
  if (!raw || typeof raw !== 'object') return null;
  return raw as SpacePaneSettingsOverride;
}

export function rowToSpacePane(row: SpacePaneRow): SpacePane {
  const decorations = parseDecorationsFromJson(row.decorations);
  const customEmotions = parseCustomEmotionsFromJson(row.custom_emotions);

  return {
    id: row.id,
    spaceId: row.space_id,
    name: row.name,
    slug: row.slug,
    sortOrder: row.sort_order,
    isDefault: row.is_default,
    isVisible: row.is_visible,
    background: (row.background as SpaceBackground | null) ?? null,
    savedBackgroundImages: row.saved_background_images ?? null,
    decorations: decorations.length > 0 ? decorations : null,
    characterImageUrl: row.character_image_url ?? null,
    characterName: row.character_name ?? null,
    customEmotions: customEmotions.length > 0 ? customEmotions : null,
    bubbleShapePng: row.bubble_shape_png ?? null,
    settings: parseSettingsOverride(row.settings),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function spacePaneToInsertRow(
  input: CreateSpacePaneInput,
): Omit<SpacePaneRow, 'created_at' | 'updated_at'> & { created_at?: string; updated_at: string } {
  const now = new Date().toISOString();
  return {
    id: input.id,
    space_id: input.spaceId,
    name: input.name,
    slug: input.slug,
    sort_order: input.sortOrder ?? 0,
    is_default: input.isDefault ?? false,
    is_visible: input.isVisible ?? true,
    background: input.background ?? null,
    saved_background_images: input.savedBackgroundImages ?? null,
    decorations: input.decorations ?? null,
    character_image_url: input.characterImageUrl ?? null,
    character_name: input.characterName ?? null,
    custom_emotions: input.customEmotions ?? null,
    bubble_shape_png: input.bubbleShapePng ?? null,
    settings: input.settings ?? null,
    created_at: now,
    updated_at: now,
  };
}

function patchToUpdateRow(
  patch: UpdateSpacePanePatch,
): Partial<Omit<SpacePaneRow, 'id' | 'space_id' | 'created_at'>> {
  const row: Partial<Omit<SpacePaneRow, 'id' | 'space_id' | 'created_at'>> = {
    updated_at: new Date().toISOString(),
  };

  if (patch.name !== undefined) row.name = patch.name;
  if (patch.slug !== undefined) row.slug = patch.slug;
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
  if (patch.isDefault !== undefined) row.is_default = patch.isDefault;
  if (patch.isVisible !== undefined) row.is_visible = patch.isVisible;
  if (patch.background !== undefined) row.background = patch.background;
  if (patch.savedBackgroundImages !== undefined) {
    row.saved_background_images = patch.savedBackgroundImages;
  }
  if (patch.decorations !== undefined) row.decorations = patch.decorations;
  if (patch.characterImageUrl !== undefined) row.character_image_url = patch.characterImageUrl;
  if (patch.characterName !== undefined) row.character_name = patch.characterName;
  if (patch.customEmotions !== undefined) row.custom_emotions = patch.customEmotions;
  if (patch.bubbleShapePng !== undefined) row.bubble_shape_png = patch.bubbleShapePng;
  if (patch.settings !== undefined) row.settings = patch.settings;

  return row;
}

/**
 * App-side pane ↔ space validation (Phase 4 wiring). Returns true when valid or legacy (no pane).
 */
export function validateHossiiPaneSpaceMatch(
  hossii: Pick<Hossii, 'spaceId' | 'spacePaneId'>,
  paneSpaceId: string | null | undefined,
): boolean {
  if (hossii.spacePaneId == null) return true;
  if (!paneSpaceId) return false;
  return paneSpaceId === hossii.spaceId;
}

export async function fetchSpacePanes(spaceId: string): Promise<SpacePane[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('space_panes')
    .select('*')
    .eq('space_id', spaceId)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });

  if (error) {
    console.error('[spacePanesApi] fetchSpacePanes error:', error.message);
    return [];
  }

  return (data as SpacePaneRow[]).map(rowToSpacePane);
}

export async function fetchDefaultSpacePane(spaceId: string): Promise<SpacePane | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from('space_panes')
    .select('*')
    .eq('space_id', spaceId)
    .eq('is_default', true)
    .maybeSingle();

  if (error) {
    console.error('[spacePanesApi] fetchDefaultSpacePane error:', error.message);
    return null;
  }

  return data ? rowToSpacePane(data as SpacePaneRow) : null;
}

export async function ensureDefaultSpacePane(spaceId: string): Promise<SpacePane | null> {
  if (!isSupabaseConfigured) return null;

  const existing = await fetchDefaultSpacePane(spaceId);
  if (existing) return existing;

  const id = defaultSpacePaneId(spaceId);
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('space_panes')
    .insert({
      id,
      space_id: spaceId,
      name: 'メイン',
      slug: 'main',
      sort_order: 0,
      is_default: true,
      is_visible: true,
      updated_at: now,
    })
    .select('*')
    .maybeSingle();

  if (error) {
    if (error.code === '23505') {
      return fetchDefaultSpacePane(spaceId);
    }
    throw error;
  }

  return data ? rowToSpacePane(data as SpacePaneRow) : fetchDefaultSpacePane(spaceId);
}

export async function createSpacePane(input: CreateSpacePaneInput): Promise<SpacePane | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from('space_panes')
    .insert(spacePaneToInsertRow(input))
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[spacePanesApi] createSpacePane error:', error.message);
    return null;
  }

  return data ? rowToSpacePane(data as SpacePaneRow) : null;
}

export async function updateSpacePane(
  id: string,
  patch: UpdateSpacePanePatch,
): Promise<SpacePane | null> {
  if (!isSupabaseConfigured) return null;

  const updateRow = patchToUpdateRow(patch);
  if (Object.keys(updateRow).length <= 1 && updateRow.updated_at) {
    return null;
  }

  const { data, error } = await supabase
    .from('space_panes')
    .update(updateRow)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[spacePanesApi] updateSpacePane error:', error.message);
    return null;
  }

  return data ? rowToSpacePane(data as SpacePaneRow) : null;
}

export async function setSpacePaneVisible(id: string, visible: boolean): Promise<SpacePane | null> {
  return updateSpacePane(id, { isVisible: visible });
}

export type { SpaceDecoration, CustomEmotion };
