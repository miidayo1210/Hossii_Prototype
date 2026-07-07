import {
  useReducer,
  useCallback,
  useMemo,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Hossii, HossiiState, HossiiAction, AddHossiiInput } from '../types';
import type { Space, SpaceId, SpaceBackground } from '../types/space';
import type { AppMode } from '../types/mode';
import type { UserProfile, SpaceNicknames } from '../types/profile';
import { DEFAULT_SPACE, DEFAULT_QUICK_EMOTIONS, DEFAULT_BACKGROUND } from '../types/space';
import { generateId } from '../utils';
import { createBubblePositionFromId } from '../utils/bubblePosition';
import {
  loadSpaces,
  saveSpaces,
  loadActiveSpaceId,
  saveActiveSpaceId,
  loadHossiis,
  saveHossiis,
} from '../utils/storage';
import { parseCustomEmotionsFromJson, parseDecorationsFromJson } from '../utils/spaceDecorations';
import { parseTabFolders } from '../utils/tabFolderStorage';
import { persistHossiisLocal } from '../utils/hossiiPersistence';
import {
  applyFetchResult,
  createEmptyEntitiesSlice,
  getHossiisForQueryKey,
  insertOrderedId,
  materializeHossiisArray,
  patchEntity,
  removeEntity,
  removeOrderedIdFromQueryKey,
  reindexIdInAllQueryKeys,
  shouldReindexOrderedIds,
  upsertEntities,
  type HossiiEntitiesSlice,
} from '../utils/hossiiEntitiesState';
import type { HossiiQueryKey } from '../utils/hossiiQueryKey';
import { queryKeysForHossii } from '../utils/hossiiQueryKey';
import { mergeFetchedHossiisWithPendingInserts } from '../utils/hossiiPendingMerge';
import {
  classifyRealtimeUpdate,
  runtimeMatchesActiveSpace,
  shouldAcceptRealtimeInsert,
} from '../utils/hossiiRealtimePane';
import { validateHossiiPaneSpaceMatch, defaultSpacePaneId } from '../utils/spacePanesApi';
import {
  EMPTY_SPACE_PANE_RUNTIME,
  SpacePaneRuntimeContext,
} from './spacePaneRuntime';
import { loadMode, saveMode } from '../utils/modeStorage';
import {
  loadProfile,
  saveProfile,
  loadSpaceNicknames,
  saveSpaceNicknames,
} from '../utils/profileStorage';
import { migrateHossiiOrigin, needsMigration, markMigrationComplete } from '../utils/migrateOldLogs';

// Supabase APIs
import { supabase, isSupabaseConfigured } from '../supabase';
import {
  fetchSpaces,
  insertSpace,
  updateSpaceInDb,
  deleteSpaceFromDb,
} from '../utils/spacesApi';
import { ensureDefaultSpacePane, healDefaultSpacePanes } from '../utils/ensureDefaultSpacePane';
import {
  insertHossii,
  updateHossiiColor,
  updateHossiiPosition,
  updateHossiiScale,
  updateHossiiPaneId,
  hideHossiiInDb,
  restoreHossiiInDb,
  deleteAllHossiisInSpace,
  coerceIsHidden,
  rowToHossii,
  type HossiiRow,
} from '../utils/hossiisApi';
import { reconcileHossiiQueryKeys } from '../utils/reconcileHossiiQueryKeys';
import { insertModerationLog } from '../utils/moderationLogsApi';
import {
  upsertProfile,
  upsertSpaceNickname,
  fetchSpaceNicknames,
} from '../utils/profilesApi';
import { useAuth } from '../contexts/useAuth';
import { useAdminNavigation } from '../contexts/useAdminNavigation';
import { HossiiContext } from './useHossiiStore';
import { setHossiiEntitiesSnapshot } from './hossiiEntityStore';
import { HossiiActionsContext } from './useHossiiActions';

// createdAt を Date に正規化（Supabase から string で来ても対応）
const normalizeHossii = (h: unknown, defaultSpaceId: SpaceId): Hossii => {
  const raw = h as Record<string, unknown>;
  return {
    id: raw.id as string,
    message: raw.message as string,
    emotion: raw.emotion as Hossii['emotion'],
    spaceId: (raw.spaceId as string) || defaultSpaceId,
    spacePaneId:
      typeof raw.spacePaneId === 'string'
        ? raw.spacePaneId
        : raw.spacePaneId === null
          ? null
          : undefined,
    authorId: typeof raw.authorId === 'string' ? raw.authorId : undefined,
    authorName: typeof raw.authorName === 'string' ? raw.authorName : undefined,
    createdAt: raw.createdAt instanceof Date
      ? raw.createdAt
      : new Date(raw.createdAt as string),
    logType: raw.logType as Hossii['logType'],
    speechLevel: raw.speechLevel as Hossii['speechLevel'],
    origin: raw.origin as Hossii['origin'],
    autoType: raw.autoType as Hossii['autoType'],
    language: raw.language as Hossii['language'],
    bubbleColor: typeof raw.bubbleColor === 'string' ? raw.bubbleColor : undefined,
    hashtags: Array.isArray(raw.hashtags) ? raw.hashtags as string[] : undefined,
    imageUrl: typeof raw.imageUrl === 'string' ? raw.imageUrl : undefined,
    positionX: typeof raw.positionX === 'number' ? raw.positionX : undefined,
    positionY: typeof raw.positionY === 'number' ? raw.positionY : undefined,
    isPositionFixed: typeof raw.isPositionFixed === 'boolean' ? raw.isPositionFixed : false,
    scale: typeof raw.scale === 'number' ? raw.scale : 1.0,
    isHidden: coerceIsHidden(raw.isHidden),
    postKind: raw.postKind === 'canvas' ? 'canvas' : 'bubble',
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : undefined,
    bubbleShapePng: typeof raw.bubbleShapePng === 'string' ? raw.bubbleShapePng : undefined,
    numberValue: typeof raw.numberValue === 'number' ? raw.numberValue : undefined,
    likeCount: typeof raw.likeCount === 'number' ? raw.likeCount : undefined,
  };
};

/**
 * fetch の応答が INSERT / Realtime より先に届くと楽観投稿が一覧に無い — その行を消さないようマージする。
 * @see mergeFetchedHossiisWithPendingInserts in hossiiPendingMerge.ts
 */
// スペースを正規化（localStorage が壊れても安全）
const normalizeSpace = (f: unknown): Space => {
  const raw = (f ?? {}) as Record<string, unknown>;

  const id = typeof raw.id === 'string' && raw.id ? raw.id : generateId();
  const name = typeof raw.name === 'string' && raw.name ? raw.name : 'My Space';

  let quickEmotions = DEFAULT_QUICK_EMOTIONS;
  if (Array.isArray(raw.quickEmotions) && raw.quickEmotions.length > 0 && raw.quickEmotions.length <= 8) {
    quickEmotions = raw.quickEmotions as Space['quickEmotions'];
  }
  if (Array.isArray(raw.allowedEmotions) && raw.allowedEmotions.length > 0 && raw.allowedEmotions.length <= 8) {
    quickEmotions = raw.allowedEmotions as Space['quickEmotions'];
  }

  let createdAt: Date;
  if (raw.createdAt instanceof Date) {
    createdAt = raw.createdAt;
  } else if (typeof raw.createdAt === 'string') {
    const parsed = new Date(raw.createdAt);
    createdAt = isNaN(parsed.getTime()) ? new Date() : parsed;
  } else {
    createdAt = new Date();
  }

  const background = isValidBackground(raw.background)
    ? (raw.background as SpaceBackground)
    : DEFAULT_BACKGROUND;

  const spaceURL = typeof raw.spaceURL === 'string' && raw.spaceURL ? raw.spaceURL : undefined;

  const savedBackgroundImages =
    Array.isArray(raw.savedBackgroundImages) &&
    raw.savedBackgroundImages.every((u) => typeof u === 'string')
      ? (raw.savedBackgroundImages as string[])
      : undefined;

  const presetTags =
    Array.isArray(raw.presetTags) && raw.presetTags.every((t) => typeof t === 'string')
      ? (raw.presetTags as string[])
      : undefined;

  const isPrivate = typeof raw.isPrivate === 'boolean' ? raw.isPrivate : undefined;
  const welcomeMessage = typeof raw.welcomeMessage === 'string' ? raw.welcomeMessage : undefined;
  const description = typeof raw.description === 'string' ? raw.description : undefined;
  const characterName = typeof raw.characterName === 'string' ? raw.characterName : undefined;
  const characterImageUrl = typeof raw.characterImageUrl === 'string' ? raw.characterImageUrl : undefined;
  const bubbleShapePng = typeof raw.bubbleShapePng === 'string' ? raw.bubbleShapePng : undefined;
  const decorations = parseDecorationsFromJson(raw.decorations);
  const customEmotions = parseCustomEmotionsFromJson(raw.customEmotions);
  const tabFolders = (() => {
    const folders = parseTabFolders(raw.tabFolders);
    return folders.length > 0 ? folders : undefined;
  })();

  const myHossiiEnabled = typeof raw.myHossiiEnabled === 'boolean' ? raw.myHossiiEnabled : undefined;
  const myHossiiMotionMode =
    raw.myHossiiMotionMode === 'free' || raw.myHossiiMotionMode === 'anchored' || raw.myHossiiMotionMode === 'auto'
      ? raw.myHossiiMotionMode
      : undefined;
  const myHossiiLogVisibility =
    raw.myHossiiLogVisibility === 'public' ||
    raw.myHossiiLogVisibility === 'authenticated' ||
    raw.myHossiiLogVisibility === 'hidden'
      ? raw.myHossiiLogVisibility
      : undefined;

  return {
    id,
    spaceURL,
    name,
    quickEmotions,
    createdAt,
    background,
    savedBackgroundImages,
    presetTags,
    isPrivate,
    welcomeMessage,
    description,
    characterName,
    characterImageUrl,
    customEmotions: customEmotions.length > 0 ? customEmotions : undefined,
    decorations: decorations.length > 0 ? decorations : undefined,
    bubbleShapePng,
    tabFolders,
    myHossiiEnabled,
    myHossiiMotionMode,
    myHossiiLogVisibility,
  };
};

// 有効な SpaceBackground かどうかをチェック
function isValidBackground(value: unknown): value is SpaceBackground {
  if (!value || typeof value !== 'object') return false;
  const bg = value as Record<string, unknown>;

  if (bg.kind === 'color' && typeof bg.value === 'string') return true;
  if (bg.kind === 'pattern' && typeof bg.value === 'string') return true;
  if (bg.kind === 'image' && typeof bg.value === 'string' && typeof bg.source === 'string') return true;

  return false;
}

// 初期化: localStorage からスペースを読み込み、なければデフォルトスペースを作成
function initializeSpaces(): { spaces: Space[]; activeSpaceId: SpaceId } {
  let spaces: Space[] = [];

  try {
    const loaded = loadSpaces();
    spaces = loaded.map(normalizeSpace);
  } catch {
    spaces = [];
  }

  if (spaces.length === 0) {
    spaces = [DEFAULT_SPACE];
    saveSpaces(spaces);
  }

  let activeSpaceId: SpaceId | null = null;
  try {
    activeSpaceId = loadActiveSpaceId();
  } catch {
    activeSpaceId = null;
  }

  if (!activeSpaceId || !spaces.find((f) => f.id === activeSpaceId)) {
    activeSpaceId = spaces[0].id;
    saveActiveSpaceId(activeSpaceId);
  }

  return { spaces, activeSpaceId };
}

// 初期化: localStorage から hossiis を読み込む
function initializeHossiis(defaultSpaceId: SpaceId, initialHossiis: Hossii[]): Hossii[] {
  try {
    const loaded = loadHossiis();
    if (loaded.length > 0) {
      const normalized = loaded.map((h) => normalizeHossii(h, defaultSpaceId));

      if (needsMigration()) {
        const migrated = normalized.map(migrateHossiiOrigin);
        const hasChanges = migrated.some((h, i) =>
          h.origin !== normalized[i].origin ||
          h.autoType !== normalized[i].autoType ||
          h.message !== normalized[i].message
        );
        if (hasChanges) {
          saveHossiis(migrated);
        }
        markMigrationComplete();
        return migrated;
      }

      return normalized;
    }
  } catch {
    // ignore
  }
  return initialHossiis.map((h) => normalizeHossii(h, defaultSpaceId));
}

// 拡張State型
type ExtendedHossiiState = HossiiState & {
  spaces: Space[];
  activeSpaceId: SpaceId;
  mode: AppMode;
  profile: UserProfile | null;
  spaceNicknames: SpaceNicknames;
  visitingSpaceId: string | null;
  entities: HossiiEntitiesSlice;
  /** getActiveSpaceHossiis が参照する queryKey（Space / Comments fetch が設定） */
  listQueryKey: HossiiQueryKey | null;
};

// 拡張Action型
type ExtendedHossiiAction =
  | HossiiAction
  | { type: 'ADD_HOSSII_FULL'; payload: Hossii }
  | { type: 'REMOVE_HOSSII'; payload: string }
  | { type: 'SET_ACTIVE_SPACE'; payload: SpaceId }
  | { type: 'SET_SPACES'; payload: Space[]; preserveIds?: Set<string> }
  | { type: 'ADD_SPACE'; payload: Space }
  | { type: 'MERGE_SPACE'; payload: Space }
  | { type: 'UPDATE_SPACE'; payload: { id: SpaceId; patch: Partial<Space> } }
  | { type: 'REMOVE_SPACE'; payload: SpaceId }
  | { type: 'SYNC_HOSSIIS'; payload: Hossii[] }
  | { type: 'SET_MODE'; payload: AppMode }
  | { type: 'SET_PROFILE'; payload: UserProfile }
  | { type: 'SET_DEFAULT_NICKNAME'; payload: string }
  | { type: 'SET_SPACE_NICKNAME'; payload: { spaceId: string; nickname: string } }
  | { type: 'SET_SPACE_NICKNAMES'; payload: SpaceNicknames }
  | { type: 'UPDATE_HOSSII_POSITION'; payload: { id: string; positionX: number; positionY: number } }
  | { type: 'UPDATE_HOSSII_SCALE'; payload: { id: string; scale: number } }
  | { type: 'UPDATE_HOSSII_COLOR'; payload: { id: string; color: string | null } }
  | { type: 'HIDE_HOSSII'; payload: { hossiiId: string; adminId?: string } }
  | { type: 'RESTORE_HOSSII'; payload: string }
  | { type: 'MOVE_HOSSII_PANE'; payload: { id: string; spacePaneId: string } }
  | { type: 'UPDATE_HOSSII_FROM_REALTIME'; payload: Hossii }
  | {
      type: 'APPLY_REALTIME_PANE_UPDATE';
      payload: {
        before: Hossii;
        after: Hossii;
        transition: 'patchOnly' | 'removeFromActive' | 'addToActive';
      };
    }
  | { type: 'SET_VISITING_SPACE'; payload: string | null }
  | {
      type: 'APPLY_FETCH_RESULT';
      payload: { queryKey: HossiiQueryKey; items: Hossii[]; merge: boolean };
    };

function hossiisFromEntities(
  state: ExtendedHossiiState,
  entities: HossiiEntitiesSlice,
  listQueryKey: HossiiQueryKey | null,
): Hossii[] {
  if (listQueryKey) {
    return getHossiisForQueryKey(entities, listQueryKey);
  }
  return materializeHossiisArray(entities, state.activeSpaceId);
}

function withEntitiesUpdate(
  state: ExtendedHossiiState,
  entities: HossiiEntitiesSlice,
  listQueryKey: HossiiQueryKey | null = state.listQueryKey,
): ExtendedHossiiState {
  const hossiis = hossiisFromEntities(state, entities, listQueryKey);
  persistHossiisLocal(hossiis);
  return { ...state, entities, listQueryKey, hossiis };
}

function insertHossiiIntoSpaceQueries(
  entities: HossiiEntitiesSlice,
  hossii: Hossii,
): HossiiEntitiesSlice {
  let next = upsertEntities(entities, [hossii]);
  const keys = queryKeysForHossii(next, hossii);
  if (keys.length === 0) {
    return next;
  }
  for (const key of keys) {
    next = insertOrderedId(next, key, hossii.id, hossii);
  }
  return next;
}

// アクティブなニックネームを取得するヘルパー
const getActiveNicknameFromState = (state: ExtendedHossiiState): string => {
  const { spaceNicknames, activeSpaceId, profile } = state;
  if (spaceNicknames[activeSpaceId]) {
    return spaceNicknames[activeSpaceId];
  }
  if (profile?.defaultNickname) {
    return profile.defaultNickname;
  }
  return '';
};

const createReducer = (activeSpaceIdRef: { current: SpaceId }) => {
  return (state: ExtendedHossiiState, action: ExtendedHossiiAction): ExtendedHossiiState => {
    switch (action.type) {
      case 'ADD_HOSSII': {
        // ADD_HOSSII_FULL を経由しない場合のフォールバック（後方互換）
        const msg = (action.payload.message ?? '').trim();
        const isLaughter = action.payload.autoType === 'laughter';
        if (!action.payload.emotion && !msg && !isLaughter) {
          return state;
        }

        let currentProfile = state.profile;
        if (!currentProfile) {
          currentProfile = {
            id: generateId(),
            defaultNickname: '',
            createdAt: new Date(),
          };
          saveProfile(currentProfile);
        }

        const authorName = action.payload.authorNameOverride ?? (getActiveNicknameFromState(state) || undefined);
        const authorId = action.payload.authorNameOverride ? undefined : currentProfile.id;
        const newHossii: Hossii = {
          id: generateId(),
          message: msg,
          emotion: action.payload.emotion,
          spaceId: activeSpaceIdRef.current,
          authorId,
          authorName,
          createdAt: new Date(),
          logType: action.payload.logType,
          speechLevel: action.payload.speechLevel,
          origin: action.payload.origin,
          autoType: action.payload.autoType,
          language: action.payload.language,
          bubbleColor: action.payload.bubbleColor,
          hashtags: action.payload.hashtags,
          imageUrl: action.payload.imageUrl,
        };
        const entities = insertHossiiIntoSpaceQueries(state.entities, newHossii);
        return withEntitiesUpdate({ ...state, profile: currentProfile }, entities);
      }

      case 'ADD_HOSSII_FULL': {
        const hossii = action.payload;
        if (state.entities.entitiesById[hossii.id]) {
          return state;
        }
        const entities = insertHossiiIntoSpaceQueries(state.entities, hossii);
        return withEntitiesUpdate(state, entities);
      }

      case 'REMOVE_HOSSII': {
        const id = action.payload;
        const spaceId = state.entities.entitiesById[id]?.spaceId;
        const entities = removeEntity(state.entities, id, spaceId);
        return withEntitiesUpdate(state, entities);
      }

      case 'SELECT_HOSSII':
        return {
          ...state,
          selectedHossiiId: action.payload,
        };

      case 'CLEAR_ALL': {
        const entities = createEmptyEntitiesSlice();
        return withEntitiesUpdate(
          { ...state, selectedHossiiId: null },
          entities,
          null,
        );
      }

      case 'SET_ACTIVE_SPACE': {
        saveActiveSpaceId(action.payload);
        activeSpaceIdRef.current = action.payload;
        return {
          ...state,
          activeSpaceId: action.payload,
        };
      }

      case 'SET_SPACES': {
        // Supabase が presetTags を返さない場合（未マイグレーション等）は
        // ローカル state の値を引き継いで上書きを防ぐ
        const mergedSpaces = action.payload.map((space) => {
          const existing = state.spaces.find((s) => s.id === space.id);
          return {
            ...space,
            presetTags: space.presetTags ?? existing?.presetTags,
            tabFolders: space.tabFolders ?? existing?.tabFolders,
          };
        });
        // Supabase fetch 中に ADD_SPACE で追加されたスペース（insert が in-flight）を保持する。
        // preserveIds に含まれるスペース ID のうち、Supabase 結果に含まれないものをローカルから引き継ぐ。
        if (action.preserveIds && action.preserveIds.size > 0) {
          const supabaseIds = new Set(action.payload.map((s) => s.id));
          const pendingSpaces = state.spaces
            .filter((s) => action.preserveIds!.has(s.id) && !supabaseIds.has(s.id))
            .map((s) => ({ ...s, presetTags: s.presetTags, tabFolders: s.tabFolders }));
          mergedSpaces.push(...pendingSpaces);
        }
        saveSpaces(mergedSpaces);
        return {
          ...state,
          spaces: mergedSpaces,
        };
      }

      case 'ADD_SPACE': {
        const newSpaces = [...state.spaces, normalizeSpace(action.payload)];
        saveSpaces(newSpaces);
        return {
          ...state,
          spaces: newSpaces,
        };
      }

      case 'MERGE_SPACE': {
        const incoming = normalizeSpace(action.payload);
        const idx = state.spaces.findIndex((s) => s.id === incoming.id);
        const newSpaces =
          idx >= 0
            ? state.spaces.map((s, i) => (i === idx ? { ...s, ...incoming } : s))
            : [...state.spaces, incoming];
        saveSpaces(newSpaces);
        return {
          ...state,
          spaces: newSpaces,
        };
      }

      case 'UPDATE_SPACE': {
        const { id, patch } = action.payload;
        const updatedSpaces = state.spaces.map((f) =>
          f.id === id ? { ...f, ...patch } : f
        );
        saveSpaces(updatedSpaces);
        return {
          ...state,
          spaces: updatedSpaces,
        };
      }

      case 'REMOVE_SPACE': {
        const spaceIdToRemove = action.payload;
        const remainingSpaces = state.spaces.filter((f) => f.id !== spaceIdToRemove);

        let newSpaces: Space[];
        if (remainingSpaces.length === 0) {
          newSpaces = [DEFAULT_SPACE];
        } else {
          newSpaces = remainingSpaces;
        }

        let newActiveSpaceId = state.activeSpaceId;
        if (state.activeSpaceId === spaceIdToRemove) {
          newActiveSpaceId = newSpaces[0].id;
          saveActiveSpaceId(newActiveSpaceId);
          activeSpaceIdRef.current = newActiveSpaceId;
        }

        saveSpaces(newSpaces);
        return {
          ...state,
          spaces: newSpaces,
          activeSpaceId: newActiveSpaceId,
        };
      }

      case 'SYNC_HOSSIIS': {
        let entities = createEmptyEntitiesSlice();
        entities = upsertEntities(entities, action.payload);
        if (state.listQueryKey) {
          entities = applyFetchResult(entities, state.listQueryKey, action.payload, false);
        }
        return withEntitiesUpdate(state, entities, state.listQueryKey);
      }

      case 'APPLY_FETCH_RESULT': {
        const { queryKey, items, merge } = action.payload;
        const entities = applyFetchResult(state.entities, queryKey, items, merge);
        return withEntitiesUpdate(state, entities, queryKey);
      }

      case 'SET_MODE': {
        saveMode(action.payload);
        return {
          ...state,
          mode: action.payload,
        };
      }

      case 'SET_PROFILE': {
        saveProfile(action.payload);
        return {
          ...state,
          profile: action.payload,
        };
      }

      case 'SET_DEFAULT_NICKNAME': {
        const nickname = action.payload.trim();
        let profile = state.profile;
        if (!profile) {
          profile = {
            id: generateId(),
            defaultNickname: nickname,
            createdAt: new Date(),
          };
        } else {
          profile = { ...profile, defaultNickname: nickname };
        }
        saveProfile(profile);
        return {
          ...state,
          profile,
        };
      }

      case 'SET_SPACE_NICKNAME': {
        const { spaceId, nickname } = action.payload;
        const newNicknames = {
          ...state.spaceNicknames,
          [spaceId]: nickname.trim(),
        };
        saveSpaceNicknames(newNicknames);
        return {
          ...state,
          spaceNicknames: newNicknames,
        };
      }

      case 'SET_SPACE_NICKNAMES': {
        const merged = {
          ...state.spaceNicknames,
          ...action.payload,
        };
        saveSpaceNicknames(merged);
        return {
          ...state,
          spaceNicknames: merged,
        };
      }

      case 'SET_VISITING_SPACE': {
        return { ...state, visitingSpaceId: action.payload };
      }

      case 'UPDATE_HOSSII_POSITION': {
        const { id, positionX, positionY } = action.payload;
        const prev = state.entities.entitiesById[id];
        if (!prev) return state;
        const updated = { ...prev, positionX, positionY, isPositionFixed: true };
        const entities = patchEntity(state.entities, updated);
        return withEntitiesUpdate(state, entities);
      }

      case 'UPDATE_HOSSII_SCALE': {
        const { id, scale } = action.payload;
        const prev = state.entities.entitiesById[id];
        if (!prev) return state;
        const entities = patchEntity(state.entities, { ...prev, scale });
        return withEntitiesUpdate(state, entities);
      }

      case 'UPDATE_HOSSII_COLOR': {
        const { id, color } = action.payload;
        const prev = state.entities.entitiesById[id];
        if (!prev) return state;
        const entities = patchEntity(state.entities, {
          ...prev,
          bubbleColor: color ?? undefined,
        });
        return withEntitiesUpdate(state, entities);
      }

      case 'HIDE_HOSSII': {
        const { hossiiId, adminId } = action.payload;
        const prev = state.entities.entitiesById[hossiiId];
        if (!prev) return state;
        const now = new Date();
        const updated = {
          ...prev,
          isHidden: true,
          hiddenAt: now,
          hiddenBy: adminId,
        };
        let entities = patchEntity(state.entities, updated);
        entities = reindexIdInAllQueryKeys(entities, hossiiId);
        return withEntitiesUpdate(state, entities);
      }

      case 'RESTORE_HOSSII': {
        const prev = state.entities.entitiesById[action.payload];
        if (!prev) return state;
        const updated = {
          ...prev,
          isHidden: false,
          hiddenAt: undefined,
          hiddenBy: undefined,
        };
        let entities = patchEntity(state.entities, updated);
        entities = reindexIdInAllQueryKeys(entities, action.payload);
        return withEntitiesUpdate(state, entities);
      }

      case 'MOVE_HOSSII_PANE': {
        const prev = state.entities.entitiesById[action.payload.id];
        if (!prev) return state;
        const updated: Hossii = {
          ...prev,
          spacePaneId: action.payload.spacePaneId,
        };
        const entities = reconcileHossiiQueryKeys(state.entities, updated);
        return withEntitiesUpdate(state, entities);
      }

      case 'UPDATE_HOSSII_FROM_REALTIME': {
        const updated = action.payload;
        const prev = state.entities.entitiesById[updated.id];
        const merged: Hossii = {
          ...updated,
          bubbleShapePng: updated.bubbleShapePng ?? prev?.bubbleShapePng,
        };
        let entities = patchEntity(state.entities, merged);
        if (shouldReindexOrderedIds(prev, merged)) {
          entities = reindexIdInAllQueryKeys(entities, merged.id);
        }
        return withEntitiesUpdate(state, entities);
      }

      case 'APPLY_REALTIME_PANE_UPDATE': {
        const { before, after, transition } = action.payload;
        const prev = state.entities.entitiesById[after.id];
        const merged: Hossii = {
          ...after,
          bubbleShapePng: after.bubbleShapePng ?? prev?.bubbleShapePng,
        };
        let entities = patchEntity(state.entities, merged);

        if (transition === 'removeFromActive') {
          const keys = queryKeysForHossii(entities, before);
          for (const key of keys) {
            entities = removeOrderedIdFromQueryKey(entities, key, after.id);
          }
        } else if (transition === 'addToActive') {
          const keys = queryKeysForHossii(entities, merged);
          for (const key of keys) {
            entities = insertOrderedId(entities, key, merged.id, merged);
          }
        } else if (shouldReindexOrderedIds(prev ?? before, merged)) {
          entities = reindexIdInAllQueryKeys(entities, merged.id);
        }

        return withEntitiesUpdate(state, entities);
      }

      default:
        return state;
    }
  };
};

export type HossiiContextValue = {
  state: ExtendedHossiiState;
  spacesLoadedFromSupabase: boolean;
  hossiiLoadedFromSupabase: boolean;
  communitySlug: string | null | undefined;
  addHossii: (input: AddHossiiInput) => void;
  selectHossii: (id: string | null) => void;
  clearAll: () => void;
  setActiveSpace: (id: SpaceId) => void;
  getActiveSpace: () => Space | undefined;
  getActiveSpaceHossiis: () => Hossii[];
  addSpace: (space: Space) => void;
  addSpaceLocal: (space: Space) => void;
  updateSpace: (id: SpaceId, patch: Partial<Space>) => void;
  removeSpace: (id: SpaceId) => void;
  setMode: (mode: AppMode) => void;
  setDefaultNickname: (nickname: string) => void;
  setSpaceNickname: (spaceId: string, nickname: string) => void;
  getActiveNickname: () => string;
  getAuthorId: () => string | undefined;
  hasNicknameForSpace: (spaceId: string) => boolean;
  setVisitingSpace: (spaceId: string | null) => void;
  updateHossiiColorAction: (id: string, color: string | null) => void;
  updateHossiiPositionAction: (id: string, positionX: number, positionY: number) => void;
  updateHossiiScaleAction: (id: string, scale: number) => void;
  hideHossii: (id: string, adminId?: string) => void;
  restoreHossii: (id: string, adminId?: string) => void;
  moveHossiiToPane: (id: string, targetPaneId: string) => Promise<void>;
  /** ページ fetch 結果を optimistic 投稿と merge して反映 */
  syncFetchedHossiis: (
    items: Hossii[],
    queryKey: HossiiQueryKey,
    options?: { merge?: boolean },
  ) => void;
  /** 明示 query key で ordered 一覧を取得 */
  getHossiisForQueryKey: (queryKey: HossiiQueryKey) => Hossii[];
  setHossiiFetchLoading: (loading: boolean) => void;
};

type HossiiProviderProps = {
  children: ReactNode;
  initialHossiis?: Hossii[];
};

export const HossiiProvider = ({ children, initialHossiis = [] }: HossiiProviderProps) => {
  const { currentUser, isResolvingAuth } = useAuth();
  const { overrideCommunityId, overrideCommunitySlug } = useAdminNavigation();
  /** 直近で成功した fetchSpaces のコミュニティ ID（スーパー管理者のスコープ切替検知用） */
  const lastScopedCommunityFetchKeyRef = useRef<string | undefined>(undefined);
  /** 直近で fetchSpaces を開始したコミュニティ ID（仕様 67 案2: ref 未定義でも fetch 前クリアを判定） */
  const lastSpacesFetchTargetRef = useRef<string | undefined>(undefined);
  /** fetchSpaces の世代（仕様 67 案 E: 古い応答を state に適用しない） */
  const spacesFetchRequestIdRef = useRef(0);
  const communityId = overrideCommunityId ?? currentUser?.communityId;
  const communitySlug = overrideCommunitySlug ?? currentUser?.communitySlug;

  const { spaces, activeSpaceId } = useMemo(() => initializeSpaces(), []);
  const initialMode = useMemo(() => loadMode(), []);
  const initialProfile = useMemo(() => loadProfile(), []);
  const initialSpaceNicknames = useMemo(() => loadSpaceNicknames(), []);

  const activeSpaceIdRef = useMemo(() => ({ current: activeSpaceId }), [activeSpaceId]);
  const authorProfileIdRef = useRef<string | undefined>(undefined);
  const spacePaneRuntimeRef = useRef({ ...EMPTY_SPACE_PANE_RUNTIME });

  const reducer = useMemo(
    () => createReducer(activeSpaceIdRef),
    [activeSpaceIdRef],
  );

  // Supabase が設定済みの場合は localStorage の古いデータを初期表示しない（フラッシュ防止）
  const initialHossiisFromStorage = useMemo(
    () => isSupabaseConfigured ? [] : initializeHossiis(activeSpaceId, initialHossiis),
    [activeSpaceId, initialHossiis]
  );

  const [state, dispatch] = useReducer(reducer, {
    hossiis: initialHossiisFromStorage,
    selectedHossiiId: null,
    spaces,
    activeSpaceId,
    mode: initialMode,
    profile: initialProfile,
    spaceNicknames: initialSpaceNicknames,
    visitingSpaceId: null,
    entities: upsertEntities(createEmptyEntitiesSlice(), initialHossiisFromStorage),
    listQueryKey: null,
  });

  // 自分が Supabase に INSERT した ID を追跡（fetch マージで掃除するまで保持）
  const insertedHossiiIdsRef = useRef<Set<string>>(new Set());
  /** SYNC で state から消えてもマージで戻せるよう楽観行を保持 */
  const pendingOptimisticHossiiRef = useRef<Map<string, Hossii>>(new Map());

  // ADD_SPACE 後の insertSpace が完了していないスペース ID を追跡
  // SET_SPACES が走ってもこれらを失わないように保持する
  const pendingSpaceIds = useRef<Set<string>>(new Set());

  // スペースの Supabase INSERT が完了するまでの Promise を保持
  // insertHossii は hossiis.space_id の外部キー制約があるため、
  // スペース INSERT が完了するまで待機してから実行する必要がある
  const pendingSpacePromises = useRef<Map<string, Promise<void>>>(new Map());

  // 最新の state を ref で保持（コールバック内でのクロージャ問題を回避）
  const stateRef = useRef(state);
  useLayoutEffect(() => {
    stateRef.current = state;
  });

  useEffect(() => {
    if (isResolvingAuth) return;

    if (currentUser && !currentUser.isAdmin) {
      authorProfileIdRef.current = currentUser.uid;
      const existing = stateRef.current.profile;
      const nextProfile: UserProfile = {
        id: currentUser.uid,
        defaultNickname: existing?.defaultNickname ?? currentUser.username ?? '',
        createdAt: existing?.createdAt ?? new Date(),
      };
      dispatch({ type: 'SET_PROFILE', payload: nextProfile });
    } else {
      authorProfileIdRef.current = undefined;
    }

    if (currentUser && isSupabaseConfigured) {
      void fetchSpaceNicknames(currentUser.uid).then((nicknames) => {
        if (Object.keys(nicknames).length > 0) {
          dispatch({ type: 'SET_SPACE_NICKNAMES', payload: nicknames });
        }
      });
    }
  }, [currentUser, isResolvingAuth]);

  useEffect(() => {
    setHossiiEntitiesSnapshot(state.entities.entitiesById);
  }, [state.entities.entitiesById]);

  // Supabase からのスペース読み込みが完了したかどうか
  // Supabase 未設定の場合は localStorage のみを使うため即 true
  const [spacesLoadedFromSupabase, setSpacesLoadedFromSupabase] = useState(!isSupabaseConfigured);

  // Supabase からの hossiis 読み込みが完了したかどうか
  const [hossiiLoadedFromSupabase, setHossiiLoadedFromSupabase] = useState(!isSupabaseConfigured);

  // スペース「一覧にどの ID が載るか」が変わったときだけ hossii を再取得する。
  // state.spaces の参照だけ変わる更新（名前・背景・presetTags 等）のたびに SYNC_HOSSIIS([]) すると、
  // 進行中の INSERT と競合し楽観投稿が消えたり、Realtime が自己 INSERT をスキップして復帰しないことがある。
  const spaceIdsSignature = useMemo(() => {
    const ids = state.spaces.map((s) => s.id);
    ids.sort();
    return ids.join('\0');
  }, [state.spaces]);

  /** hossii 同期 effect が「同じスペースの再 fetch」か「スペース切替」かを判別する */
  const prevHossiiSyncSpaceIdRef = useRef<string | null>(null);

  // ===== Supabase: スペースをマウント時に同期 =====
  // isResolvingAuth が true の間は発火しない。
  // これにより管理者ユーザーで communityId が undefined → 確定値と2回 fetchSpaces が
  // 走る二重リクエストを排除し、1回で正しい communityId のスペースを取得できる。
  //
  // スーパー管理者で override / 自コミュニティ ID が無いときは fetchSpaces(undefined) による
  // 全件取得を行わない（仕様 67）。
  // スコープ付き fetch が一度成功したあと communityId が変わるときは、旧一覧を先に空にしてから取得する。
  // 案2: 開始済みターゲットと effectiveId の比較で fetch 前クリア。案 E: 世代で古い応答を破棄。
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    if (isResolvingAuth) return;

    const skipAllTenantFetch =
      currentUser?.isSuperAdmin === true &&
      !overrideCommunityId &&
      !currentUser?.communityId;

    if (skipAllTenantFetch) {
      // 仕様 67 案1: 一覧にいる間も ref を維持する。ここで undefined に戻すと A→一覧→B のとき
      // prevKey が空のままになり fetch 前クリアが効かず、直前コミュニティの spaces が残る。
      // 案 E: 進行中の fetch の完了で state を汚さないよう世代を進める。
      spacesFetchRequestIdRef.current += 1;
      queueMicrotask(() => setSpacesLoadedFromSupabase(true));
      return;
    }

    const effectiveId = communityId;
    if (effectiveId == null || effectiveId === '') {
      lastScopedCommunityFetchKeyRef.current = undefined;
      lastSpacesFetchTargetRef.current = undefined;
      spacesFetchRequestIdRef.current += 1;
      queueMicrotask(() => setSpacesLoadedFromSupabase(true));
      return;
    }

    const prevTarget = lastSpacesFetchTargetRef.current;
    const shouldClearBeforeFetch = prevTarget !== effectiveId;

    const preserveIds = new Set(pendingSpaceIds.current);
    const requestId = ++spacesFetchRequestIdRef.current;
    lastSpacesFetchTargetRef.current = effectiveId;

    const applySpaces = (supabaseSpaces: Space[] | null) => {
      if (requestId !== spacesFetchRequestIdRef.current) return;

      if (supabaseSpaces !== null) {
        dispatch({ type: 'SET_SPACES', payload: supabaseSpaces, preserveIds });
        healDefaultSpacePanes(supabaseSpaces.map((s) => s.id));
        lastScopedCommunityFetchKeyRef.current = effectiveId;
        const st = stateRef.current;
        if (
          supabaseSpaces.length > 0 &&
          !supabaseSpaces.some((s) => s.id === st.activeSpaceId)
        ) {
          dispatch({ type: 'SET_ACTIVE_SPACE', payload: supabaseSpaces[0].id });
        }
      }
      setSpacesLoadedFromSupabase(true);
    };

    /* eslint-disable react-hooks/set-state-in-effect -- fetch 直前に spacesLoaded を false に固定（queue だと完了後の true より遅れる） */
    if (shouldClearBeforeFetch) {
      insertedHossiiIdsRef.current.clear();
      pendingOptimisticHossiiRef.current.clear();
      setSpacesLoadedFromSupabase(false);
      dispatch({ type: 'SET_SPACES', payload: [], preserveIds: new Set() });
      dispatch({ type: 'SYNC_HOSSIIS', payload: [] });
      fetchSpaces(effectiveId).then(applySpaces);
    } else {
      setSpacesLoadedFromSupabase(false);
      fetchSpaces(effectiveId).then(applySpaces);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [
    communityId,
    isResolvingAuth,
    overrideCommunityId,
    currentUser?.isSuperAdmin,
    currentUser?.communityId,
  ]);

  // ===== Supabase: アクティブスペースの hossiis は useSpaceHossiiFetch が取得 =====
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const { spaces: spList, activeSpaceId: aid } = stateRef.current;
    if (!spList.some((s) => s.id === aid)) {
      insertedHossiiIdsRef.current.clear();
      pendingOptimisticHossiiRef.current.clear();
      queueMicrotask(() => {
        setHossiiLoadedFromSupabase(false);
        dispatch({ type: 'SYNC_HOSSIIS', payload: [] });
        setHossiiLoadedFromSupabase(true);
      });
      prevHossiiSyncSpaceIdRef.current = aid;
      return;
    }

    const activeSpaceId = state.activeSpaceId;
    const spaceChanged = prevHossiiSyncSpaceIdRef.current !== activeSpaceId;
    prevHossiiSyncSpaceIdRef.current = activeSpaceId;

    if (spaceChanged) {
      insertedHossiiIdsRef.current.clear();
      pendingOptimisticHossiiRef.current.clear();
      queueMicrotask(() => {
        setHossiiLoadedFromSupabase(false);
        dispatch({ type: 'SYNC_HOSSIIS', payload: [] });
      });
    }
  }, [state.activeSpaceId, spaceIdsSignature]);

  const syncFetchedHossiis = useCallback((
    supabaseHossiis: Hossii[],
    queryKey: HossiiQueryKey,
    options?: { merge?: boolean },
  ) => {
    const activeSpaceId = stateRef.current.activeSpaceId;
    const merged = mergeFetchedHossiisWithPendingInserts(
      supabaseHossiis,
      activeSpaceId,
      stateRef.current.hossiis,
      insertedHossiiIdsRef,
      pendingOptimisticHossiiRef,
      queryKey,
    );
    dispatch({
      type: 'APPLY_FETCH_RESULT',
      payload: { queryKey, items: merged, merge: options?.merge ?? false },
    });
    setHossiiLoadedFromSupabase(true);
  }, []);

  const setHossiiFetchLoading = useCallback((loading: boolean) => {
    setHossiiLoadedFromSupabase(!loading);
  }, []);

  // ===== 旧: fetchHossiis 全件 — useSpaceHossiiFetch に移行 =====
  // （削除済み）

  // ===== Supabase Realtime: hossiis の INSERT/UPDATE/DELETE を購読 =====
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const activeSpaceId = state.activeSpaceId;

    // サーバーサイドフィルタは REPLICA IDENTITY FULL が必要なため
    // フィルタなしで購読し、クライアントサイドでスペースIDをチェックする
    const channel = supabase
      .channel(`hossiis_realtime:${activeSpaceId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'hossiis' },
        (payload) => {
          const row = payload.new as HossiiRow;
          if (row.space_id !== activeSpaceId) return;
          const hossii = rowToHossii(row);
          const runtime = spacePaneRuntimeRef.current;
          if (!shouldAcceptRealtimeInsert(hossii, runtime, activeSpaceId)) return;
          // 自分が INSERT した場合は重複 ADD のみ避ける。insertedHossiiIdsRef は fetch マージで掃除する
          // （ここで delete すると、遅れて届く古い fetch が楽観行をマージせず消す）。
          if (insertedHossiiIdsRef.current.has(row.id)) {
            if (!stateRef.current.hossiis.some((h) => h.id === row.id)) {
              dispatch({ type: 'ADD_HOSSII_FULL', payload: hossii });
            }
            return;
          }
          dispatch({ type: 'ADD_HOSSII_FULL', payload: hossii });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'hossiis' },
        (payload) => {
          const row = payload.new as HossiiRow;
          if (row.space_id !== activeSpaceId) return;
          const after = rowToHossii(row);
          const runtime = spacePaneRuntimeRef.current;
          if (!runtimeMatchesActiveSpace(runtime, activeSpaceId)) return;

          const before = stateRef.current.entities.entitiesById[row.id];
          if (!before) {
            if (shouldAcceptRealtimeInsert(after, runtime, activeSpaceId)) {
              dispatch({ type: 'ADD_HOSSII_FULL', payload: after });
            }
            return;
          }

          const transition = classifyRealtimeUpdate(before, after, runtime);
          if (transition === 'ignore') return;
          if (transition === 'patchOnly') {
            dispatch({ type: 'UPDATE_HOSSII_FROM_REALTIME', payload: after });
            return;
          }
          dispatch({
            type: 'APPLY_REALTIME_PANE_UPDATE',
            payload: { before, after, transition },
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'hossiis' },
        (payload) => {
          const id = (payload.old as { id: string }).id;
          dispatch({ type: 'REMOVE_HOSSII', payload: id });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] hossiis subscribed for space:', activeSpaceId);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[Realtime] hossiis channel error:', status, activeSpaceId);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [state.activeSpaceId]);

  // ===== localStorage の storage イベント（同一ブラウザ別タブ向け、Supabase 未設定時のフォールバック）=====
  useEffect(() => {
    if (isSupabaseConfigured) return; // Supabase が有効なら Realtime を使う

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'hossii.hossiis' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            const synced = parsed.map((h) => normalizeHossii(h, activeSpaceIdRef.current));
            dispatch({ type: 'SYNC_HOSSIIS', payload: synced });
          }
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [activeSpaceIdRef]);

  // ===== addHossii: 楽観的更新 → Supabase INSERT =====
  const addHossii = useCallback((input: AddHossiiInput) => {
    const msg = (input.message ?? '').trim();
    const isLaughter = input.autoType === 'laughter';
    const hasImage = !!input.imageUrl;
    const hasNumber = input.numberValue != null;
    const isCanvas = input.postKind === 'canvas';
    if (isCanvas) {
      if (!input.imageUrl) return;
    } else if (!input.emotion && !msg && !isLaughter && !hasImage && !hasNumber) {
      return;
    }

    const currentState = stateRef.current;
    const activeSpaceId = activeSpaceIdRef.current;
    const runtime = spacePaneRuntimeRef.current;

    if (!runtimeMatchesActiveSpace(runtime, activeSpaceId)) return;
    const activePaneId = runtime.activePaneId;
    if (activePaneId == null) return;
    if (
      !validateHossiiPaneSpaceMatch(
        { spaceId: activeSpaceId, spacePaneId: activePaneId },
        activeSpaceId,
      )
    ) {
      return;
    }

    // プロフィールが無ければ作成
    let profile = currentState.profile;
    if (!profile) {
      profile = {
        id: authorProfileIdRef.current ?? generateId(),
        defaultNickname: '',
        createdAt: new Date(),
      };
      dispatch({ type: 'SET_PROFILE', payload: profile });
      saveProfile(profile);
    } else if (authorProfileIdRef.current && profile.id !== authorProfileIdRef.current) {
      profile = { ...profile, id: authorProfileIdRef.current };
      dispatch({ type: 'SET_PROFILE', payload: profile });
      saveProfile(profile);
    }

    const authorId = input.authorNameOverride ? undefined : profile.id;
    const authorName =
      input.authorNameOverride ??
      (getActiveNicknameFromState(currentState) || undefined);

    // 投稿時に初期座標を確定する（id ベースの決定論的配置）
    const id = generateId();
    const initialPos = createBubblePositionFromId(id);
    const defaultCanvasScale = 1.2;

    const newHossii: Hossii = isCanvas
      ? {
          id,
          message: msg,
          spaceId: activeSpaceId,
          spacePaneId: activePaneId,
          authorId,
          authorName,
          createdAt: new Date(),
          origin: input.origin ?? 'manual',
          imageUrl: input.imageUrl,
          postKind: 'canvas',
          positionX: input.positionX ?? initialPos.x,
          positionY: input.positionY ?? initialPos.y,
          isPositionFixed: input.isPositionFixed ?? true,
          scale: input.scale ?? defaultCanvasScale,
          hashtags: input.hashtags,
          tags: input.tags,
        }
      : {
          id,
          message: msg,
          emotion: input.emotion,
          spaceId: activeSpaceId,
          spacePaneId: activePaneId,
          authorId,
          authorName,
          createdAt: new Date(),
          logType: input.logType,
          speechLevel: input.speechLevel,
          origin: input.origin,
          autoType: input.autoType,
          language: input.language,
          bubbleColor: input.bubbleColor,
          bubbleShapePng: input.bubbleShapePng,
          hashtags: input.hashtags,
          tags: input.tags,
          imageUrl: input.imageUrl,
          numberValue: input.numberValue,
          positionX: input.positionX ?? initialPos.x,
          positionY: input.positionY ?? initialPos.y,
          isPositionFixed: input.isPositionFixed ?? false,
          postKind: 'bubble',
        };

    // 楽観的更新（即時 UI 反映）
    dispatch({ type: 'ADD_HOSSII_FULL', payload: newHossii });

    // Supabase に非同期 INSERT
    // hossiis.space_id は spaces.id の外部キーのため、スペース INSERT が
    // 完了していない場合は待機してから実行する
    if (isSupabaseConfigured) {
      insertedHossiiIdsRef.current.add(newHossii.id);
      pendingOptimisticHossiiRef.current.set(newHossii.id, newHossii);
      const spacePending = pendingSpacePromises.current.get(newHossii.spaceId);
      const insertPromise = spacePending
        ? spacePending.then(() => insertHossii(newHossii))
        : insertHossii(newHossii);
      insertPromise
        .then((ok) => {
          if (ok === false) {
            insertedHossiiIdsRef.current.delete(newHossii.id);
            pendingOptimisticHossiiRef.current.delete(newHossii.id);
            dispatch({ type: 'REMOVE_HOSSII', payload: newHossii.id });
          }
        })
        .catch(() => {
          insertedHossiiIdsRef.current.delete(newHossii.id);
          pendingOptimisticHossiiRef.current.delete(newHossii.id);
          dispatch({ type: 'REMOVE_HOSSII', payload: newHossii.id });
        });
    }
  }, [activeSpaceIdRef]);

  const selectHossii = useCallback((id: string | null) => {
    dispatch({ type: 'SELECT_HOSSII', payload: id });
  }, []);

  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
    if (isSupabaseConfigured) {
      deleteAllHossiisInSpace(activeSpaceIdRef.current);
    }
  }, [activeSpaceIdRef]);

  const setActiveSpace = useCallback((id: SpaceId) => {
    dispatch({ type: 'SET_ACTIVE_SPACE', payload: id });
  }, []);

  const getActiveSpace = useCallback(() => {
    return state.spaces.find((f) => f.id === state.activeSpaceId);
  }, [state.spaces, state.activeSpaceId]);

  const getHossiisForQueryKeyFn = useCallback(
    (queryKey: HossiiQueryKey) => getHossiisForQueryKey(state.entities, queryKey),
    [state.entities],
  );

  const getActiveSpaceHossiis = useCallback(() => {
    if (state.listQueryKey) {
      return getHossiisForQueryKey(state.entities, state.listQueryKey);
    }
    return state.hossiis.filter((h) => h.spaceId === state.activeSpaceId);
  }, [state.entities, state.listQueryKey, state.hossiis, state.activeSpaceId]);

  const addSpace = useCallback((space: Space) => {
    pendingSpaceIds.current.add(space.id);
    dispatch({ type: 'ADD_SPACE', payload: space });
    if (isSupabaseConfigured) {
      const promise = insertSpace(space, communityId)
        .then(() => ensureDefaultSpacePane(space.id).then(() => undefined))
        .finally(() => {
        pendingSpaceIds.current.delete(space.id);
        pendingSpacePromises.current.delete(space.id);
      });
      pendingSpacePromises.current.set(space.id, promise);
    } else {
      pendingSpaceIds.current.delete(space.id);
    }
  }, [communityId]);

  // Supabase から取得済みのスペースをローカル state に追加する（DB insert は行わない）
  // URL スラッグ直アクセス時のファストパス用
  const addSpaceLocal = useCallback((space: Space) => {
    dispatch({ type: 'MERGE_SPACE', payload: space });
  }, []);

  const updateSpace = useCallback((id: SpaceId, patch: Partial<Space>) => {
    dispatch({ type: 'UPDATE_SPACE', payload: { id, patch } });
    if (isSupabaseConfigured) {
      updateSpaceInDb(id, patch).catch((err: unknown) => {
        console.error('[updateSpace] Supabase 保存失敗:', err);
      });
    }
  }, []);

  const removeSpace = useCallback((id: SpaceId) => {
    const spaceToDelete = stateRef.current.spaces.find((s) => s.id === id);
    dispatch({ type: 'REMOVE_SPACE', payload: id });
    if (isSupabaseConfigured && spaceToDelete) {
      deleteSpaceFromDb(id).then((success) => {
        if (!success) {
          console.error('[removeSpace] Supabase DELETE 失敗 → ローカル状態を復元します');
          dispatch({ type: 'ADD_SPACE', payload: spaceToDelete });
          alert('スペースの削除に失敗しました。権限がないか、通信エラーが発生しました。');
        }
      });
    }
  }, [stateRef]);

  const setMode = useCallback((mode: AppMode) => {
    dispatch({ type: 'SET_MODE', payload: mode });
  }, []);

  const setDefaultNickname = useCallback((nickname: string) => {
    dispatch({ type: 'SET_DEFAULT_NICKNAME', payload: nickname });
    // ログイン済みの場合のみ Supabase に同期（認証実装後に条件追加）
    if (isSupabaseConfigured) {
      const profile = stateRef.current.profile;
      if (profile) {
        upsertProfile({ ...profile, defaultNickname: nickname.trim() });
      }
    }
  }, []);

  const setSpaceNickname = useCallback((spaceId: string, nickname: string) => {
    dispatch({ type: 'SET_SPACE_NICKNAME', payload: { spaceId, nickname } });
    if (isSupabaseConfigured) {
      const profile = stateRef.current.profile;
      const nicknameProfileId = currentUser?.uid ?? profile?.id;
      if (!nicknameProfileId) return;

      if (currentUser?.uid) {
        void upsertProfile({
          id: currentUser.uid,
          defaultNickname: profile?.defaultNickname ?? currentUser.username ?? '',
          createdAt: profile?.createdAt ?? new Date(),
        });
      }

      void upsertSpaceNickname(nicknameProfileId, spaceId, nickname.trim());
    }
  }, [currentUser?.uid, currentUser?.username]);

  const getActiveNickname = useCallback(() => {
    return getActiveNicknameFromState(state);
  }, [state]);

  const getAuthorId = useCallback((): string | undefined => {
    if (currentUser && !currentUser.isAdmin) {
      return currentUser.uid;
    }
    return state.profile?.id;
  }, [currentUser, state.profile?.id]);

  const hasNicknameForSpace = useCallback((spaceId: string) => {
    return !!state.spaceNicknames[spaceId];
  }, [state.spaceNicknames]);

  const setVisitingSpace = useCallback((spaceId: string | null) => {
    dispatch({ type: 'SET_VISITING_SPACE', payload: spaceId });
  }, []);

  const updateHossiiColorAction = useCallback((id: string, color: string | null) => {
    dispatch({ type: 'UPDATE_HOSSII_COLOR', payload: { id, color } });
    if (isSupabaseConfigured) {
      updateHossiiColor(id, color);
    }
  }, []);

  const updateHossiiPositionAction = useCallback((id: string, positionX: number, positionY: number) => {
    dispatch({ type: 'UPDATE_HOSSII_POSITION', payload: { id, positionX, positionY } });
    if (isSupabaseConfigured) {
      updateHossiiPosition(id, positionX, positionY);
    }
  }, []);

  const updateHossiiScaleAction = useCallback((id: string, scale: number) => {
    dispatch({ type: 'UPDATE_HOSSII_SCALE', payload: { id, scale } });
    if (isSupabaseConfigured) {
      updateHossiiScale(id, scale);
    }
  }, []);

  const hideHossii = useCallback((id: string, adminId?: string) => {
    const hossii = state.hossiis.find((h) => h.id === id);
    dispatch({ type: 'HIDE_HOSSII', payload: { hossiiId: id, adminId } });
    if (isSupabaseConfigured) {
      hideHossiiInDb(id, adminId);
      if (hossii && adminId) {
        insertModerationLog({ spaceId: hossii.spaceId, hossiiId: id, action: 'hide', adminId });
      }
    }
  }, [state.hossiis]);

  const restoreHossii = useCallback((id: string, adminId?: string) => {
    const hossii = state.hossiis.find((h) => h.id === id);
    dispatch({ type: 'RESTORE_HOSSII', payload: id });
    if (isSupabaseConfigured) {
      restoreHossiiInDb(id);
      if (hossii && adminId) {
        insertModerationLog({ spaceId: hossii.spaceId, hossiiId: id, action: 'restore', adminId });
      }
    }
  }, [state.hossiis]);

  const moveHossiiToPane = useCallback(
    async (id: string, targetPaneId: string) => {
      const hossii =
        state.entities.entitiesById[id] ?? state.hossiis.find((h) => h.id === id);
      if (!hossii) return;
      if (
        !validateHossiiPaneSpaceMatch(
          { spaceId: hossii.spaceId, spacePaneId: targetPaneId },
          hossii.spaceId,
        )
      ) {
        return;
      }

      const rollbackPaneId = hossii.spacePaneId ?? defaultSpacePaneId(hossii.spaceId);
      dispatch({ type: 'MOVE_HOSSII_PANE', payload: { id, spacePaneId: targetPaneId } });

      if (isSupabaseConfigured) {
        const ok = await updateHossiiPaneId(id, hossii.spaceId, targetPaneId);
        if (!ok) {
          dispatch({
            type: 'MOVE_HOSSII_PANE',
            payload: { id, spacePaneId: rollbackPaneId },
          });
        }
      }
    },
    [state.entities.entitiesById, state.hossiis],
  );

  return (
    <SpacePaneRuntimeContext.Provider value={spacePaneRuntimeRef}>
    <HossiiContext.Provider
      value={{
        state,
        spacesLoadedFromSupabase,
        hossiiLoadedFromSupabase,
        communitySlug,
        addHossii,
        selectHossii,
        clearAll,
        setActiveSpace,
        getActiveSpace,
        getActiveSpaceHossiis,
        getHossiisForQueryKey: getHossiisForQueryKeyFn,
        addSpace,
        addSpaceLocal,
        updateSpace,
        removeSpace,
        setMode,
        setDefaultNickname,
        setSpaceNickname,
        getActiveNickname,
        getAuthorId,
        hasNicknameForSpace,
        setVisitingSpace,
        updateHossiiColorAction,
        updateHossiiPositionAction,
        updateHossiiScaleAction,
        hideHossii,
        restoreHossii,
        moveHossiiToPane,
        syncFetchedHossiis,
        setHossiiFetchLoading,
      }}
    >
      <HossiiActionsContext.Provider
        value={{
          addHossii,
          selectHossii,
          clearAll,
          setActiveSpace,
          getActiveSpace,
          getActiveSpaceHossiis,
          getHossiisForQueryKey: getHossiisForQueryKeyFn,
          addSpace,
          addSpaceLocal,
          updateSpace,
          removeSpace,
          setMode,
          setDefaultNickname,
          setSpaceNickname,
          getActiveNickname,
          getAuthorId,
          hasNicknameForSpace,
          setVisitingSpace,
          updateHossiiColorAction,
          updateHossiiPositionAction,
          updateHossiiScaleAction,
          hideHossii,
          restoreHossii,
          moveHossiiToPane,
          syncFetchedHossiis,
          setHossiiFetchLoading,
        }}
      >
        {children}
      </HossiiActionsContext.Provider>
    </HossiiContext.Provider>
    </SpacePaneRuntimeContext.Provider>
  );
};

