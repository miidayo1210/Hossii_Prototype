import { supabase, isSupabaseConfigured } from '../supabase';
import { appendDemoSpacePane, removeDemoSpacePane, saveDemoSpacePanesForSpace } from './demoSpacePanesStorage';
import { canDeletePane } from './spacePaneManagement';
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

const PANE_SLUG_MAX_LEN = 40;

/** Build [a-z0-9-] slug from pane name; fallback pane-{shortId} when empty (§7.1 / §27 #3). */
export function generatePaneSlugFromName(name: string, fallbackId: string): string {
  let slug = name
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, PANE_SLUG_MAX_LEN);

  const validSingle = /^[a-z0-9]$/.test(slug);
  const validMulti =
    slug.length >= 2 && /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug);

  if (!validSingle && !validMulti) {
    const short = fallbackId.replace(/-/g, '').slice(0, 8);
    slug = `pane-${short}`;
  }

  return slug.slice(0, PANE_SLUG_MAX_LEN);
}

/** Ensure slug is unique within the space (append -2, -3, …). */
export function uniquePaneSlug(baseSlug: string, existingSlugs: string[]): string {
  const taken = new Set(existingSlugs.map((s) => s.toLowerCase()));
  if (!taken.has(baseSlug.toLowerCase())) return baseSlug;

  for (let n = 2; n <= 99; n++) {
    const suffix = `-${n}`;
    const trimmed = baseSlug.slice(0, Math.max(1, PANE_SLUG_MAX_LEN - suffix.length));
    const candidate = `${trimmed}${suffix}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }

  return `${baseSlug.slice(0, 30)}-${Date.now().toString(36).slice(-4)}`;
}

function parseSettingsOverride(raw: unknown): SpacePaneSettingsOverride | null {
  if (!raw || typeof raw !== 'object') return null;
  return raw as SpacePaneSettingsOverride;
}

export type CreateSpacePaneResult =
  | { ok: true; pane: SpacePane }
  | { ok: false; error: string };

export function buildSpacePaneFromInput(input: CreateSpacePaneInput): SpacePane {
  const now = new Date();
  return {
    id: input.id,
    spaceId: input.spaceId,
    name: input.name,
    slug: input.slug,
    sortOrder: input.sortOrder ?? 0,
    isDefault: input.isDefault ?? false,
    isVisible: input.isVisible ?? true,
    background: input.background ?? null,
    savedBackgroundImages: input.savedBackgroundImages ?? null,
    decorations: input.decorations ?? null,
    characterImageUrl: input.characterImageUrl ?? null,
    characterName: input.characterName ?? null,
    customEmotions: input.customEmotions ?? null,
    bubbleShapePng: input.bubbleShapePng ?? null,
    settings: input.settings ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

function formatSpacePaneCreateError(error: { message: string; code?: string }): string {
  if (error.code === '42501') {
    return 'タブの作成にはコミュニティ管理者またはスーパー管理者としてのログインが必要です';
  }
  if (error.code === '23505') {
    return '同じ識別子のタブが既に存在します';
  }
  return `タブの作成に失敗しました（${error.message}）`;
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

function applySpacePanePatch(pane: SpacePane, patch: UpdateSpacePanePatch): SpacePane {
  const now = new Date();
  return {
    ...pane,
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.slug !== undefined ? { slug: patch.slug } : {}),
    ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
    ...(patch.isDefault !== undefined ? { isDefault: patch.isDefault } : {}),
    ...(patch.isVisible !== undefined ? { isVisible: patch.isVisible } : {}),
    ...(patch.background !== undefined ? { background: patch.background ?? null } : {}),
    ...(patch.savedBackgroundImages !== undefined
      ? { savedBackgroundImages: patch.savedBackgroundImages ?? null }
      : {}),
    ...(patch.decorations !== undefined ? { decorations: patch.decorations ?? null } : {}),
    ...(patch.characterImageUrl !== undefined
      ? { characterImageUrl: patch.characterImageUrl ?? null }
      : {}),
    ...(patch.characterName !== undefined ? { characterName: patch.characterName ?? null } : {}),
    ...(patch.customEmotions !== undefined ? { customEmotions: patch.customEmotions ?? null } : {}),
    ...(patch.bubbleShapePng !== undefined ? { bubbleShapePng: patch.bubbleShapePng ?? null } : {}),
    ...(patch.settings !== undefined ? { settings: patch.settings ?? null } : {}),
    updatedAt: now,
  };
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

export async function createSpacePane(input: CreateSpacePaneInput): Promise<CreateSpacePaneResult> {
  if (!isSupabaseConfigured) {
    const pane = buildSpacePaneFromInput(input);
    appendDemoSpacePane(pane);
    return { ok: true, pane };
  }

  const { data, error } = await supabase
    .from('space_panes')
    .insert(spacePaneToInsertRow(input))
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[spacePanesApi] createSpacePane error:', error.message);
    return { ok: false, error: formatSpacePaneCreateError(error) };
  }

  if (!data) {
    return { ok: false, error: 'タブの作成に失敗しました' };
  }

  return { ok: true, pane: rowToSpacePane(data as SpacePaneRow) };
}

export async function updateSpacePane(
  id: string,
  patch: UpdateSpacePanePatch,
  context?: { allPanes?: SpacePane[] },
): Promise<SpacePane | null> {
  if (!isSupabaseConfigured) {
    const allPanes = context?.allPanes;
    if (!allPanes?.length) return null;

    const pane = allPanes.find((p) => p.id === id);
    if (!pane) return null;

    const updated = applySpacePanePatch(pane, patch);
    const next = allPanes.map((p) => (p.id === id ? updated : p));
    saveDemoSpacePanesForSpace(pane.spaceId, next);
    return updated;
  }

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

export async function applySpacePaneSortOrders(
  updates: Array<{ id: string; sortOrder: number }>,
  context?: { allPanes?: SpacePane[] },
): Promise<boolean> {
  if (updates.length === 0) return false;

  if (!isSupabaseConfigured) {
    const allPanes = context?.allPanes;
    if (!allPanes?.length) return false;

    const orderMap = new Map(updates.map((u) => [u.id, u.sortOrder]));
    const spaceId = allPanes[0]?.spaceId;
    if (!spaceId) return false;

    const now = new Date();
    const next = allPanes.map((pane) => ({
      ...pane,
      sortOrder: orderMap.get(pane.id) ?? pane.sortOrder,
      updatedAt: orderMap.has(pane.id) ? now : pane.updatedAt,
    }));

    saveDemoSpacePanesForSpace(spaceId, next);
    return true;
  }

  for (const { id, sortOrder } of updates) {
    const result = await updateSpacePane(id, { sortOrder });
    if (!result) return false;
  }

  return true;
}

function formatSpacePaneDeleteError(error: { message: string; code?: string }): string {
  if (error.code === '42501') {
    return 'タブの削除にはコミュニティ管理者またはスーパー管理者としてのログインが必要です';
  }
  return `タブの削除に失敗しました（${error.message}）`;
}

export async function deleteSpacePane(
  pane: SpacePane,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!canDeletePane(pane)) {
    return { ok: false, error: 'メインタブは削除できません' };
  }

  if (!isSupabaseConfigured) {
    removeDemoSpacePane(pane.spaceId, pane.id);
    return { ok: true };
  }

  const { error } = await supabase.from('space_panes').delete().eq('id', pane.id);

  if (error) {
    console.error('[spacePanesApi] deleteSpacePane error:', error.message);
    return { ok: false, error: formatSpacePaneDeleteError(error) };
  }

  return { ok: true };
}

export type { SpaceDecoration, CustomEmotion };
