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
import type { Hossii, HossiiState, HossiiAction, AddHossiiInput, HossiiVisibility } from '../types';
import type { Space, SpaceId, SpaceBackground, SpaceUpdatePatch } from '../types/space';
import type { AppMode } from '../types/mode';
import type { UserProfile, SpaceNicknames } from '../types/profile';
import { DEFAULT_SPACE, DEFAULT_QUICK_EMOTIONS, DEFAULT_BACKGROUND } from '../types/space';
import {
  buildAddHossiiBlockMessage,
  isKnownSpaceInState,
} from '../utils/addHossiiGuard';
import { emitPostFailure, formatInsertHossiiErrorMessage, mapInsertFailureReason } from '../utils/postFeedback';
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
import { normalizeParticipationMode } from '../utils/participationMode';
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
import { ensureDefaultSpacePane } from '../utils/ensureDefaultSpacePane';
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
import {
  updateMyHossii,
  setMyHossiiVisibility,
  softDeleteMyHossii,
} from '../utils/myHossiiMutationsApi';
import { insertModerationLog } from '../utils/moderationLogsApi';
import { fetchMyAuthorshipIdsForSpace } from '../utils/hossiiAuthorshipsApi';
import {
  createMyAuthorshipIdsController,
  EMPTY_MY_AUTHORSHIP_IDS,
  type MyAuthorshipIdsSnapshot,
  type MyAuthorshipIdsStatus,
} from '../utils/myAuthorshipIdsController';
import {
  createAuthorshipControllerHost,
  type AuthorshipControllerHost,
} from '../utils/authorshipControllerHost';
import { joinSpaceAsMember } from '../utils/spaceMembershipsApi';
import { checkCanAccessSpace } from '../utils/spaceAccessApi';
import {
  createMembershipJoinController,
  resolveMembershipNickname,
  type MembershipJoinController,
} from '../utils/membershipJoinController';
import { fetchSpacePostAuthorDisplayNames } from '../utils/spacePostAuthorNamesApi';
import {
  createPostAuthorNamesController,
  EMPTY_POST_AUTHOR_NAMES,
  type PostAuthorNamesController,
  type PostAuthorNamesSnapshot,
} from '../utils/postAuthorNamesController';
import { createControllerHost, type ControllerHost } from '../utils/controllerHost';
import {
  upsertProfile,
  upsertSpaceNickname,
  fetchSpaceNicknames,
  fetchLegacyDefaultNickname,
} from '../utils/profilesApi';
import { upsertUserProfile } from '../utils/userProfilesApi';
import { useAuth } from '../contexts/useAuth';
import { useAdminNavigation } from '../contexts/useAdminNavigation';
import { useSelectedCommunity } from '../contexts/useSelectedCommunity';
import { resolveSpacesCommunityId } from '../utils/adminCommunityScope';
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
// export: fetchSpaceByUrl → MERGE_SPACE 経路と同じ正規化を統合テストで検証するため。
// eslint-disable-next-line react-refresh/only-export-components -- 純粋関数。HMR 対象外の共有ヘルパー
export const normalizeSpace = (f: unknown): Space => {
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
  const accessMode =
    raw.accessMode === 'invite_only' ? 'invite_only' : raw.accessMode === 'public' ? 'public' : undefined;
  const participationMode = normalizeParticipationMode(raw.participationMode);
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

  // コミュニティ / スペース種別のメタデータ（fetchSpaceByUrl → MERGE_SPACE 経路でも保持する）。
  // これを落とすと個人スペースショートカット（「わたし」タブ）の表示条件・active 判定が
  // 成立しなくなるため、必ず引き継ぐ。
  const communityId = typeof raw.communityId === 'string' && raw.communityId ? raw.communityId : undefined;
  const spaceType = raw.spaceType === 'personal' ? 'personal' : raw.spaceType === 'shared' ? 'shared' : undefined;
  const ownerUserId = typeof raw.ownerUserId === 'string' && raw.ownerUserId ? raw.ownerUserId : undefined;
  const isArchived = typeof raw.isArchived === 'boolean' ? raw.isArchived : false;
  const archivedAt =
    typeof raw.archivedAt === 'string' && raw.archivedAt ? new Date(raw.archivedAt) : undefined;
  const archivedBy = typeof raw.archivedBy === 'string' && raw.archivedBy ? raw.archivedBy : undefined;

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
    accessMode,
    participationMode,
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
    communityId,
    spaceType,
    ownerUserId,
    isArchived,
    archivedAt,
    archivedBy,
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
  if (isSupabaseConfigured) {
    let activeSpaceId: SpaceId | null = null;
    try {
      activeSpaceId = loadActiveSpaceId();
    } catch {
      activeSpaceId = null;
    }
    return { spaces: [], activeSpaceId: activeSpaceId ?? '' };
  }

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
  | { type: 'UPDATE_SPACE'; payload: { id: SpaceId; patch: SpaceUpdatePatch } }
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
  | { type: 'UPDATE_HOSSII_LIKE_COUNT'; payload: { id: string; likeCount: number } }
  | { type: 'HIDE_HOSSII'; payload: { hossiiId: string; adminId?: string } }
  | { type: 'RESTORE_HOSSII'; payload: string }
  | { type: 'EDIT_HOSSII_CONTENT'; payload: { id: string; message: string; contentEditedAt: Date | null } }
  | { type: 'SET_HOSSII_VISIBILITY'; payload: { id: string; visibility: HossiiVisibility } }
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
        const updatedSpaces = state.spaces.map((f): Space => {
          if (f.id !== id) return f;
          const { bubbleShapePng, ...patchRest } = patch;
          const next: Space = { ...f, ...patchRest };
          if (bubbleShapePng === null) {
            delete next.bubbleShapePng;
          } else if (bubbleShapePng !== undefined) {
            next.bubbleShapePng = bubbleShapePng;
          }
          return next;
        });
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

      case 'UPDATE_HOSSII_LIKE_COUNT': {
        const { id, likeCount } = action.payload;
        const prev = state.entities.entitiesById[id];
        if (!prev) return state;
        const entities = patchEntity(state.entities, {
          ...prev,
          likeCount: Math.max(0, likeCount),
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

      case 'EDIT_HOSSII_CONTENT': {
        // Phase 2D-2: 本人による本文編集。message と content_edited_at のみ更新し、
        // identity / visibility / pane 等には触れない。
        const { id, message, contentEditedAt } = action.payload;
        const prev = state.entities.entitiesById[id];
        if (!prev) return state;
        const entities = patchEntity(state.entities, { ...prev, message, contentEditedAt });
        return withEntitiesUpdate(state, entities);
      }

      case 'SET_HOSSII_VISIBILITY': {
        // Phase 2D-2: 本人による公開範囲変更（public <-> owner_only）。
        const { id, visibility } = action.payload;
        const prev = state.entities.entitiesById[id];
        if (!prev) return state;
        const entities = patchEntity(state.entities, { ...prev, visibility });
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

/** Phase 2D-2: 本人投稿ミューテーションの結果（UI 側でエラー表示に使う） */
export type OwnPostMutationResult =
  | { ok: true }
  | { ok: false; message?: string };

export type HossiiContextValue = {
  state: ExtendedHossiiState;
  spacesLoadedFromSupabase: boolean;
  hossiiLoadedFromSupabase: boolean;
  communitySlug: string | null | undefined;
  /** ログイン本人の authorship 由来 hossii_id 集合（本人性の正本）。利用側から書き換え不可 */
  myAuthorshipIds: ReadonlySet<string>;
  /** myAuthorshipIds の取得状態。'ready' 以外は本人判定に信頼しない */
  myAuthorshipIdsStatus: MyAuthorshipIdsStatus;
  /**
   * 投稿 ID → 投稿者の現在スペースニックネーム（Phase 2C）。
   * 過去投稿の主表示名を現在名に解決するために使う。含まれない投稿は投稿時名へ fallback。
   * ゲスト投稿・membership 無し・nickname 未設定は含まれない。書き換え不可。
   */
  postAuthorDisplayNames: ReadonlyMap<string, string>;
  addHossii: (input: AddHossiiInput) => Promise<boolean>;
  selectHossii: (id: string | null) => void;
  clearAll: () => void;
  setActiveSpace: (id: SpaceId) => void;
  getActiveSpace: () => Space | undefined;
  getActiveSpaceHossiis: () => Hossii[];
  addSpace: (space: Space) => void;
  addSpaceLocal: (space: Space) => void;
  updateSpace: (id: SpaceId, patch: SpaceUpdatePatch) => void;
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
  updateHossiiLikeCountAction: (id: string, likeCount: number) => void;
  hideHossii: (id: string, adminId?: string) => void;
  restoreHossii: (id: string, adminId?: string) => void;
  moveHossiiToPane: (id: string, targetPaneId: string) => Promise<void>;
  /** Phase 2D-2: 本人による本文編集（optimistic → RPC → 失敗時 rollback） */
  editMyHossiiContent: (id: string, message: string) => Promise<OwnPostMutationResult>;
  /** Phase 2D-2: 本人による公開範囲変更（public <-> owner_only） */
  setMyHossiiVisibilityAction: (id: string, visibility: HossiiVisibility) => Promise<OwnPostMutationResult>;
  /** Phase 2D-2: 本人によるソフト削除（物理 DELETE はしない） */
  softDeleteMyHossiiAction: (id: string) => Promise<OwnPostMutationResult>;
  /**
   * Phase 2F: 指定スペースの「投稿者の現在表示名」マップを強制再取得する。
   * スペースニックネーム変更後、過去投稿の現在名をリロードなしで反映するために使う。
   * アクティブスペースと一致するときだけ再取得する（別スペースの取得で現在の表示を汚さない）。
   */
  refreshPostAuthorDisplayNames: (spaceId: string) => void;
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
  const { selectedCommunityId } = useSelectedCommunity();
  /** 直近で成功した fetchSpaces のコミュニティ ID（スーパー管理者のスコープ切替検知用） */
  const lastScopedCommunityFetchKeyRef = useRef<string | undefined>(undefined);
  /** 直近で fetchSpaces を開始したコミュニティ ID（仕様 67 案2: ref 未定義でも fetch 前クリアを判定） */
  const lastSpacesFetchTargetRef = useRef<string | undefined>(undefined);
  /** fetchSpaces の世代（仕様 67 案 E: 古い応答を state に適用しない） */
  const spacesFetchRequestIdRef = useRef(0);
  const communityId = useMemo(() => {
    const managed = currentUser?.adminCommunities ?? [];
    const resolved = resolveSpacesCommunityId({
      overrideCommunityId,
      selectedCommunityId,
      fallbackCommunityId: currentUser?.communityId,
      managedCommunities: managed,
      isSuperAdmin: currentUser?.isSuperAdmin === true,
    });
    return resolved ?? undefined;
  }, [
    currentUser?.adminCommunities,
    currentUser?.communityId,
    currentUser?.isSuperAdmin,
    overrideCommunityId,
    selectedCommunityId,
  ]);
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

  // 最新の currentUser を ref で保持（addHossii など deps を増やせないコールバックから参照）
  const currentUserRef = useRef(currentUser);
  useLayoutEffect(() => {
    currentUserRef.current = currentUser;
  });

  // ===== myAuthorshipIds（本人性の正本）の取得・保持 =====
  // 実データの race / reset / fetch 判断は純粋な controller に委譲し、
  // ここでは snapshot を state に反映するだけの薄い glue にする。
  const [authorshipSnapshot, setAuthorshipSnapshot] = useState<MyAuthorshipIdsSnapshot>(
    () => ({ ids: EMPTY_MY_AUTHORSHIP_IDS, status: 'idle' }),
  );
  // controller のライフサイクルはホストへ集約する。StrictMode の cleanup で dispose した
  // 破棄済み instance を掴み続けないよう、生成/差し替えは必ずホスト経由で行う（Phase 1D-2-fix）。
  const authorshipHostRef = useRef<AuthorshipControllerHost | null>(null);
  if (authorshipHostRef.current === null) {
    authorshipHostRef.current = createAuthorshipControllerHost(() =>
      createMyAuthorshipIdsController({
        fetchIds: fetchMyAuthorshipIdsForSpace,
        onChange: setAuthorshipSnapshot,
        // PII（UUID 等）を出さず、失敗の事実のみ最小限で記録する。
        onError: () => {
          console.error('[HossiiStore] failed to load authorship ids');
        },
      }),
    );
  }

  useEffect(() => {
    if (isResolvingAuth) return;

    if (!currentUser?.uid) {
      authorProfileIdRef.current = undefined;
      return;
    }

    authorProfileIdRef.current = currentUser.uid;

    const syncLoggedInProfile = async () => {
      const existing = stateRef.current.profile;
      const isStaleGuestProfile = Boolean(existing && existing.id !== currentUser.uid);

      let defaultNickname = '';
      if (!isStaleGuestProfile && existing?.defaultNickname?.trim()) {
        defaultNickname = existing.defaultNickname.trim();
      }
      if (!defaultNickname && currentUser.username?.trim()) {
        defaultNickname = currentUser.username.trim();
      }
      if (!defaultNickname && currentUser.displayName?.trim()) {
        defaultNickname = currentUser.displayName.trim();
      }
      if (!defaultNickname && isSupabaseConfigured) {
        const legacyNickname = await fetchLegacyDefaultNickname(currentUser.uid);
        if (legacyNickname) {
          defaultNickname = legacyNickname;
        }
      }

      const nextProfile: UserProfile = {
        id: currentUser.uid,
        defaultNickname,
        createdAt: isStaleGuestProfile ? new Date() : (existing?.createdAt ?? new Date()),
      };
      dispatch({ type: 'SET_PROFILE', payload: nextProfile });
      saveProfile(nextProfile);

      if (isSupabaseConfigured) {
        const nicknames = await fetchSpaceNicknames(currentUser.uid);
        dispatch({ type: 'SET_SPACE_NICKNAMES', payload: nicknames });
      }
    };

    void syncLoggedInProfile();
  }, [
    currentUser?.uid,
    currentUser?.username,
    currentUser?.displayName,
    isResolvingAuth,
  ]);

  // ログイン・スペース切替・セッション復元後に authorship を取得 / ログアウト・ゲスト・
  // 未確定時はクリア。stale response と前 space/前 user の残存は controller が防ぐ。
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    // 破棄済み instance を掴まないよう必ずホスト経由で取得する。
    // StrictMode の 2 回目 setup（cleanup で dispose 済み）でも新 instance が生成される。
    authorshipHostRef.current?.getOrCreate().sync({
      authReady: !isResolvingAuth,
      uid: currentUser?.uid ?? null,
      spaceId: state.activeSpaceId || null,
    });
  }, [currentUser?.uid, state.activeSpaceId, isResolvingAuth]);

  // Provider unmount 相当。以後の in-flight 反映を止める。
  // StrictMode: setup で controller を確保し、cleanup では「その controller が現在値のときだけ」
  // dispose して保持をクリアする。次の setup では getOrCreate が新 instance を生成する。
  // genuine unmount 後は setup が再実行されないため保持は null のままで、再生成は起きない。
  useEffect(() => {
    const host = authorshipHostRef.current;
    const controller = host?.getOrCreate();
    return () => {
      if (host && controller) {
        host.disposeIfCurrent(controller);
      }
    };
  }, []);

  // ===== space_memberships の自動登録（Phase 2B）=====
  // ログインユーザーが active space に入ったら、その所属を space_memberships へ登録する。
  // 実行条件・(uid+spaceId) の重複抑止・user/space 切替や再ログイン時の再実行は controller に委譲。
  // role は渡さない（RPC 側で 'member' 固定）。membership 登録の失敗は space 表示・ログインへ
  // 影響させず、PII を出さずに console.error へ記録するだけにとどめる。
  // controller は React state を持たず購読もしないため、authorship のような dispose は不要
  // （StrictMode の二重 setup は controller 内の in-flight / lastSuccessKey で吸収する）。
  const membershipJoinRef = useRef<MembershipJoinController | null>(null);
  if (membershipJoinRef.current === null) {
    membershipJoinRef.current = createMembershipJoinController({
      join: (spaceId, nickname) => joinSpaceAsMember(spaceId, nickname),
      onError: () => {
        console.error('[HossiiStore] failed to register space membership');
      },
    });
  }

  useEffect(() => {
    const activeSpace = state.spaces.find((s) => s.id === state.activeSpaceId);
    const allowAutoJoin = activeSpace?.accessMode !== 'invite_only';

    membershipJoinRef.current?.sync({
      configured: isSupabaseConfigured,
      authReady: !isResolvingAuth,
      uid: currentUser?.uid ?? null,
      spaceId: state.activeSpaceId || null,
      // ログインアカウント（auth uid）が無い＝ゲスト。ゲストは membership を作らない。
      isGuest: !currentUser?.uid,
      allowAutoJoin,
      // nickname は既存 state / currentUser からのみ解決（追加 DB query なし）。取得失敗は null。
      resolveNickname: () =>
        resolveMembershipNickname(
          {
            spaceNicknames: stateRef.current.spaceNicknames,
            profileDefaultNickname: stateRef.current.profile?.defaultNickname,
            username: currentUserRef.current?.username,
            displayName: currentUserRef.current?.displayName,
          },
          stateRef.current.activeSpaceId,
        ),
    });
  }, [currentUser?.uid, state.activeSpaceId, state.spaces, isResolvingAuth]);

  // ===== 投稿者の現在表示名マップ（Phase 2C）=====
  // 過去投稿に「現在のスペースニックネーム」を表示するため、space 単位で
  // 投稿 ID → 現在表示名 のマップを取得・保持する。取得は anon でも可（PII は返らない）。
  // authorship 同様、space 切替時は旧 space の値を即クリアし、stale 応答は seq guard で破棄する。
  // 取得失敗しても投稿表示は止めず、投稿時名（author_name）へ fallback する。
  const [postAuthorNamesSnapshot, setPostAuthorNamesSnapshot] =
    useState<PostAuthorNamesSnapshot>(() => ({
      names: EMPTY_POST_AUTHOR_NAMES,
      status: 'idle',
    }));
  const postAuthorNamesHostRef = useRef<ControllerHost<PostAuthorNamesController> | null>(
    null,
  );
  if (postAuthorNamesHostRef.current === null) {
    postAuthorNamesHostRef.current = createControllerHost(() =>
      createPostAuthorNamesController({
        fetchNames: fetchSpacePostAuthorDisplayNames,
        onChange: setPostAuthorNamesSnapshot,
        onError: () => {
          console.error('[HossiiStore] failed to load post author display names');
        },
      }),
    );
  }

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    postAuthorNamesHostRef.current?.getOrCreate().sync({
      ready: !isResolvingAuth,
      spaceId: state.activeSpaceId || null,
    });
  }, [state.activeSpaceId, isResolvingAuth]);

  useEffect(() => {
    const host = postAuthorNamesHostRef.current;
    const controller = host?.getOrCreate();
    return () => {
      if (host && controller) {
        host.disposeIfCurrent(controller);
      }
    };
  }, []);

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
        for (const space of supabaseSpaces) {
          pendingSpaceIds.current.delete(space.id);
        }
        dispatch({ type: 'SET_SPACES', payload: supabaseSpaces, preserveIds });
        lastScopedCommunityFetchKeyRef.current = effectiveId;
        const st = stateRef.current;
        const activeStillValid = supabaseSpaces.some((s) => s.id === st.activeSpaceId);
        if (!activeStillValid) {
          dispatch({
            type: 'SET_ACTIVE_SPACE',
            payload: supabaseSpaces[0]?.id ?? '',
          });
        }
      }
      setSpacesLoadedFromSupabase(true);
    };

    /* eslint-disable react-hooks/set-state-in-effect -- fetch 直前に spacesLoaded を false に固定（queue だと完了後の true より遅れる） */
    if (shouldClearBeforeFetch) {
      insertedHossiiIdsRef.current.clear();
      pendingOptimisticHossiiRef.current.clear();
      setSpacesLoadedFromSupabase(false);
      dispatch({ type: 'SET_SPACES', payload: [], preserveIds });
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
    selectedCommunityId,
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
  // invite_only 等で can_access_space=false のときは購読しない（RLS に加え二重ガード）。
  useEffect(() => {
    if (!isSupabaseConfigured || !state.activeSpaceId) return;

    const activeSpaceId = state.activeSpaceId;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void checkCanAccessSpace(activeSpaceId).then((allowed) => {
      if (cancelled || !allowed) return;

      channel = supabase
        .channel(`hossiis_realtime:${activeSpaceId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'hossiis' },
          (payload) => {
            const row = payload.new as HossiiRow;
            if (row.space_id !== activeSpaceId) return;
            const hossii = rowToHossii(row);
            if (hossii.deletedAt) return;
            const runtime = spacePaneRuntimeRef.current;
            if (!shouldAcceptRealtimeInsert(hossii, runtime, activeSpaceId)) return;
            if (insertedHossiiIdsRef.current.has(row.id)) {
              if (!stateRef.current.hossiis.some((h) => h.id === row.id)) {
                dispatch({ type: 'ADD_HOSSII_FULL', payload: hossii });
              }
              return;
            }
            dispatch({ type: 'ADD_HOSSII_FULL', payload: hossii });
          },
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'hossiis' },
          (payload) => {
            const row = payload.new as HossiiRow;
            if (row.space_id !== activeSpaceId) return;
            const after = rowToHossii(row);
            if (after.deletedAt) {
              dispatch({ type: 'REMOVE_HOSSII', payload: row.id });
              return;
            }
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
          },
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'hossiis' },
          (payload) => {
            const id = (payload.old as { id: string }).id;
            dispatch({ type: 'REMOVE_HOSSII', payload: id });
          },
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[Realtime] hossiis subscribed for space:', activeSpaceId);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error('[Realtime] hossiis channel error:', status, activeSpaceId);
          }
        });
    });

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
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
  const addHossii = useCallback(async (input: AddHossiiInput): Promise<boolean> => {
    const msg = (input.message ?? '').trim();
    const isLaughter = input.autoType === 'laughter';
    const hasImage = !!input.imageUrl;
    const hasNumber = input.numberValue != null;
    const isCanvas = input.postKind === 'canvas';
    if (isCanvas) {
      if (!input.imageUrl) return false;
    } else if (!input.emotion && !msg && !isLaughter && !hasImage && !hasNumber) {
      return false;
    }

    const currentState = stateRef.current;
    const activeSpaceId = activeSpaceIdRef.current;
    const runtime = spacePaneRuntimeRef.current;
    const usingPostOverride = input.postSpaceId != null;
    const targetSpaceId = input.postSpaceId ?? activeSpaceId;
    const targetPaneId = input.postPaneId ?? runtime.activePaneId;

    if (
      isSupabaseConfigured &&
      !isKnownSpaceInState(
        targetSpaceId,
        currentState.spaces.map((space) => space.id),
      )
    ) {
      emitPostFailure({
        reason: 'space_unavailable',
        message: buildAddHossiiBlockMessage('space_unavailable'),
      });
      return false;
    }

    if (!usingPostOverride) {
      if (!runtimeMatchesActiveSpace(runtime, activeSpaceId)) {
        emitPostFailure({
          reason: 'space_unavailable',
          message: buildAddHossiiBlockMessage('space_unavailable'),
        });
        return false;
      }
    }
    if (targetPaneId == null) {
      emitPostFailure({
        reason: 'pane_unavailable',
        message: buildAddHossiiBlockMessage('pane_unavailable'),
      });
      return false;
    }
    if (
      !validateHossiiPaneSpaceMatch(
        { spaceId: targetSpaceId, spacePaneId: targetPaneId },
        targetSpaceId,
      )
    ) {
      emitPostFailure({
        reason: 'pane_space_mismatch',
        message: buildAddHossiiBlockMessage('pane_space_mismatch'),
      });
      return false;
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
          spaceId: targetSpaceId,
          spacePaneId: targetPaneId,
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
          spaceId: targetSpaceId,
          spacePaneId: targetPaneId,
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
    if (isSupabaseConfigured) {
      insertedHossiiIdsRef.current.add(newHossii.id);
      pendingOptimisticHossiiRef.current.set(newHossii.id, newHossii);
      const spacePending = pendingSpacePromises.current.get(newHossii.spaceId);
      try {
        const insertResult = spacePending
          ? await spacePending.then(() => insertHossii(newHossii))
          : await insertHossii(newHossii);
        if (!insertResult.ok) {
          insertedHossiiIdsRef.current.delete(newHossii.id);
          pendingOptimisticHossiiRef.current.delete(newHossii.id);
          dispatch({ type: 'REMOVE_HOSSII', payload: newHossii.id });
          emitPostFailure({
            reason: mapInsertFailureReason(insertResult.message, insertResult.code),
            code: insertResult.code,
            message: formatInsertHossiiErrorMessage(insertResult.message, insertResult.code),
          });
          return false;
        }
        // INSERT 成功: trigger が authorship を作成済み。
        // ログイン中かつ投稿先が現在のアクティブスペースのままなら、DB から本人性を
        // 正本として再取得して Set を同期する（新規投稿直後の本人編集を可能にする）。
        // 直接 Set 追加はしない（DB を正本とし、stale response 上書きを避ける）。
        // ゲスト投稿は trigger が authorship を作らないため refresh 不要。
        const authorshipUid = currentUserRef.current?.uid;
        if (authorshipUid) {
          // peek() は生成しないため、unmount 後（保持が null）の非同期呼び出しでも
          // 新 controller を復活させない。破棄済み instance を掴むこともない。
          authorshipHostRef.current?.peek()?.refresh({
            uid: authorshipUid,
            spaceId: newHossii.spaceId,
          });
        }
        return true;
      } catch {
        insertedHossiiIdsRef.current.delete(newHossii.id);
        pendingOptimisticHossiiRef.current.delete(newHossii.id);
        dispatch({ type: 'REMOVE_HOSSII', payload: newHossii.id });
        emitPostFailure({
          reason: 'insert_failed',
          message: buildAddHossiiBlockMessage('pane_unavailable'),
        });
        return false;
      }
    }

    return true;
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
    // slug 直リンクの MERGE_SPACE は fetchSpaces 前クリアで消えないよう preserve 対象にする
    pendingSpaceIds.current.add(space.id);
    dispatch({ type: 'MERGE_SPACE', payload: space });
  }, []);

  const updateSpace = useCallback((id: SpaceId, patch: SpaceUpdatePatch) => {
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
    const trimmed = nickname.trim();
    dispatch({ type: 'SET_DEFAULT_NICKNAME', payload: trimmed });
    if (isSupabaseConfigured) {
      const profile = stateRef.current.profile;
      if (profile) {
        upsertProfile({ ...profile, defaultNickname: trimmed });
      }
      if (currentUser?.uid) {
        void upsertUserProfile(currentUser.uid, trimmed);
      }
    }
  }, [currentUser]);

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
  }, [currentUser]);

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
    const spaceNickname = state.spaceNicknames[spaceId]?.trim();
    if (spaceNickname) return true;

    if (!currentUser) return false;

    const defaultNickname = state.profile?.defaultNickname?.trim();
    if (defaultNickname) return true;

    if (currentUser.username?.trim()) return true;
    if (currentUser.displayName?.trim()) return true;

    return false;
  }, [state.spaceNicknames, state.profile?.defaultNickname, currentUser]);

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

  const updateHossiiLikeCountAction = useCallback((id: string, likeCount: number) => {
    dispatch({ type: 'UPDATE_HOSSII_LIKE_COUNT', payload: { id, likeCount } });
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

  // ===== Phase 2D-2: 本人投稿の操作（編集 / 公開範囲 / ソフト削除）=====
  // すべて optimistic 更新 → SECURITY DEFINER RPC → 失敗時 rollback。
  // 本人確認は RPC(auth.uid() + hossii_authorships) が正本。ここでは identity を渡さない。
  const editMyHossiiContent = useCallback(
    async (id: string, message: string): Promise<OwnPostMutationResult> => {
      const prev = stateRef.current.entities.entitiesById[id];
      if (!prev) return { ok: false, message: '投稿が見つかりません' };
      const prevMessage = prev.message;
      const prevEditedAt = prev.contentEditedAt ?? null;

      dispatch({
        type: 'EDIT_HOSSII_CONTENT',
        payload: { id, message, contentEditedAt: new Date() },
      });

      if (!isSupabaseConfigured) return { ok: true };

      const res = await updateMyHossii(id, message);
      if (!res.ok) {
        dispatch({
          type: 'EDIT_HOSSII_CONTENT',
          payload: { id, message: prevMessage, contentEditedAt: prevEditedAt },
        });
        return { ok: false, message: res.message };
      }
      // 成功時は DB が返した content_edited_at を正本として反映する。
      dispatch({
        type: 'EDIT_HOSSII_CONTENT',
        payload: { id, message, contentEditedAt: res.contentEditedAt },
      });
      return { ok: true };
    },
    [],
  );

  const setMyHossiiVisibilityAction = useCallback(
    async (id: string, visibility: HossiiVisibility): Promise<OwnPostMutationResult> => {
      const prev = stateRef.current.entities.entitiesById[id];
      if (!prev) return { ok: false, message: '投稿が見つかりません' };
      const prevVisibility = prev.visibility ?? 'public';
      if (prevVisibility === visibility) return { ok: true };

      dispatch({ type: 'SET_HOSSII_VISIBILITY', payload: { id, visibility } });

      if (!isSupabaseConfigured) return { ok: true };

      const res = await setMyHossiiVisibility(id, visibility);
      if (!res.ok) {
        dispatch({
          type: 'SET_HOSSII_VISIBILITY',
          payload: { id, visibility: prevVisibility },
        });
        return { ok: false, message: res.message };
      }
      return { ok: true };
    },
    [],
  );

  const softDeleteMyHossiiAction = useCallback(
    async (id: string): Promise<OwnPostMutationResult> => {
      const prev = stateRef.current.entities.entitiesById[id];
      if (!prev) return { ok: false, message: '投稿が見つかりません' };

      // optimistic: 一覧から即時除去。
      dispatch({ type: 'REMOVE_HOSSII', payload: id });

      if (!isSupabaseConfigured) return { ok: true };

      const res = await softDeleteMyHossii(id);
      if (!res.ok) {
        // 失敗時は元の投稿を復元する（画面から消えたままにしない）。
        dispatch({ type: 'ADD_HOSSII_FULL', payload: prev });
        return { ok: false, message: res.message };
      }
      return { ok: true };
    },
    [],
  );

  const refreshPostAuthorDisplayNames = useCallback((spaceId: string) => {
    if (!isSupabaseConfigured || !spaceId) return;
    // アクティブスペース以外の再取得は snapshot を汚すため行わない
    // （controller は現在表示中の 1 スペース分だけを保持する）。
    if (spaceId !== stateRef.current.activeSpaceId) return;
    // peek() は controller を生成しない（unmount 後に復活させない）。
    postAuthorNamesHostRef.current?.peek()?.refresh(spaceId);
  }, []);

  return (
    <SpacePaneRuntimeContext.Provider value={spacePaneRuntimeRef}>
    <HossiiContext.Provider
      value={{
        state,
        spacesLoadedFromSupabase,
        hossiiLoadedFromSupabase,
        communitySlug,
        myAuthorshipIds: authorshipSnapshot.ids,
        myAuthorshipIdsStatus: authorshipSnapshot.status,
        postAuthorDisplayNames: postAuthorNamesSnapshot.names,
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
        updateHossiiLikeCountAction,
        hideHossii,
        restoreHossii,
        moveHossiiToPane,
        editMyHossiiContent,
        setMyHossiiVisibilityAction,
        softDeleteMyHossiiAction,
        refreshPostAuthorDisplayNames,
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
          updateHossiiLikeCountAction,
          hideHossii,
          restoreHossii,
          moveHossiiToPane,
          editMyHossiiContent,
          setMyHossiiVisibilityAction,
          softDeleteMyHossiiAction,
          refreshPostAuthorDisplayNames,
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

