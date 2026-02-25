import {
  useReducer,
  useCallback,
  createContext,
  useContext,
  useMemo,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Hossii, HossiiState, HossiiAction, AddHossiiInput } from '../types';
import type { Space, SpaceId, CardType, SpaceBackground } from '../types/space';
import type { AppMode } from '../types/mode';
import type { UserProfile, SpaceNicknames } from '../types/profile';
import { DEFAULT_SPACE, DEFAULT_QUICK_EMOTIONS, DEFAULT_BACKGROUND } from '../types/space';
import { generateId } from '../utils';
import {
  loadSpaces,
  saveSpaces,
  loadActiveSpaceId,
  saveActiveSpaceId,
  loadHossiis,
  saveHossiis,
} from '../utils/storage';
import { loadMode, saveMode } from '../utils/modeStorage';
import {
  loadProfile,
  saveProfile,
  loadSpaceNicknames,
  saveSpaceNicknames,
} from '../utils/profileStorage';
import { loadShowHossii, saveShowHossii } from '../utils/hossiiDisplayStorage';
import {
  loadListenMode,
  saveListenMode,
  loadListenConsent,
  saveListenConsent,
  loadEmotionLogEnabled,
  saveEmotionLogEnabled,
  loadSpeechLogEnabled,
  saveSpeechLogEnabled,
  loadSpeechLevels,
  saveSpeechLevels,
  type SpeechLevelSettings,
} from '../utils/listenStorage';
import { migrateHossiiOrigin, needsMigration, markMigrationComplete } from '../utils/migrateOldLogs';
import { loadDisplayScale, saveDisplayScale, type DisplayScale } from '../utils/displayScaleStorage';

// Supabase APIs
import { supabase, isSupabaseConfigured } from '../supabase';
import {
  fetchSpaces,
  insertSpace,
  updateSpaceInDb,
  deleteSpaceFromDb,
} from '../utils/spacesApi';
import {
  fetchHossiis,
  insertHossii,
  deleteAllHossiisInSpace,
  rowToHossii,
  type HossiiRow,
} from '../utils/hossiisApi';
import {
  upsertProfile,
  upsertSpaceNickname,
} from '../utils/profilesApi';

// createdAt を Date に正規化（Supabase から string で来ても対応）
const normalizeHossii = (h: unknown, defaultSpaceId: SpaceId): Hossii => {
  const raw = h as Record<string, unknown>;
  return {
    id: raw.id as string,
    message: raw.message as string,
    emotion: raw.emotion as Hossii['emotion'],
    spaceId: (raw.spaceId as string) || defaultSpaceId,
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
  };
};

// 有効な CardType かどうかをチェック
const isValidCardType = (value: unknown): value is CardType => {
  return value === 'stamp' || value === 'constellation';
};

// 有効な SpaceBackground かどうかをチェック
const isValidBackground = (value: unknown): value is SpaceBackground => {
  if (!value || typeof value !== 'object') return false;
  const bg = value as Record<string, unknown>;

  if (bg.kind === 'color' && typeof bg.value === 'string') return true;
  if (bg.kind === 'pattern' && typeof bg.value === 'string') return true;
  if (bg.kind === 'image' && typeof bg.value === 'string' && typeof bg.source === 'string') return true;

  return false;
};

// スペースを正規化（localStorage が壊れても安全）
const normalizeSpace = (f: unknown): Space => {
  const raw = (f ?? {}) as Record<string, unknown>;

  const id = typeof raw.id === 'string' && raw.id ? raw.id : generateId();
  const name = typeof raw.name === 'string' && raw.name ? raw.name : 'My Space';
  const cardType = isValidCardType(raw.cardType) ? raw.cardType : 'constellation';

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

  return { id, spaceURL, name, cardType, quickEmotions, createdAt, background };
};

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
  showHossii: boolean;
  listenMode: boolean;
  hasConsentedToListen: boolean;
  emotionLogEnabled: boolean;
  speechLogEnabled: boolean;
  speechLevels: SpeechLevelSettings;
  displayScale: DisplayScale;
};

// 拡張Action型
type ExtendedHossiiAction =
  | HossiiAction
  | { type: 'ADD_HOSSII_FULL'; payload: Hossii }
  | { type: 'REMOVE_HOSSII'; payload: string }
  | { type: 'SET_ACTIVE_SPACE'; payload: SpaceId }
  | { type: 'SET_SPACES'; payload: Space[] }
  | { type: 'ADD_SPACE'; payload: Space }
  | { type: 'UPDATE_SPACE'; payload: { id: SpaceId; patch: Partial<Space> } }
  | { type: 'REMOVE_SPACE'; payload: SpaceId }
  | { type: 'SYNC_HOSSIIS'; payload: Hossii[] }
  | { type: 'SET_MODE'; payload: AppMode }
  | { type: 'SET_PROFILE'; payload: UserProfile }
  | { type: 'SET_DEFAULT_NICKNAME'; payload: string }
  | { type: 'SET_SPACE_NICKNAME'; payload: { spaceId: string; nickname: string } }
  | { type: 'SET_SHOW_HOSSII'; payload: boolean }
  | { type: 'SET_LISTEN_MODE'; payload: boolean }
  | { type: 'SET_LISTEN_CONSENT'; payload: boolean }
  | { type: 'SET_EMOTION_LOG_ENABLED'; payload: boolean }
  | { type: 'SET_SPEECH_LOG_ENABLED'; payload: boolean }
  | { type: 'SET_SPEECH_LEVELS'; payload: SpeechLevelSettings }
  | { type: 'SET_DISPLAY_SCALE'; payload: DisplayScale };

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
        const newHossii: Hossii = {
          id: generateId(),
          message: msg,
          emotion: action.payload.emotion,
          spaceId: activeSpaceIdRef.current,
          authorId: action.payload.authorNameOverride ? undefined : currentProfile.id,
          authorName,
          createdAt: new Date(),
          logType: action.payload.logType,
          speechLevel: action.payload.speechLevel,
          origin: action.payload.origin,
          autoType: action.payload.autoType,
          language: action.payload.language,
        };
        const newHossiis = [...state.hossiis, newHossii];
        saveHossiis(newHossiis);
        return {
          ...state,
          profile: currentProfile,
          hossiis: newHossiis,
        };
      }

      case 'ADD_HOSSII_FULL': {
        // 完全な Hossii オブジェクトを直接追加（Supabase 経由・Realtime 経由共通）
        const hossii = action.payload;
        if (state.hossiis.some((h) => h.id === hossii.id)) {
          return state; // 重複回避
        }
        const newHossiis = [...state.hossiis, hossii];
        saveHossiis(newHossiis);
        return {
          ...state,
          hossiis: newHossiis,
        };
      }

      case 'REMOVE_HOSSII': {
        const newHossiis = state.hossiis.filter((h) => h.id !== action.payload);
        saveHossiis(newHossiis);
        return {
          ...state,
          hossiis: newHossiis,
        };
      }

      case 'SELECT_HOSSII':
        return {
          ...state,
          selectedHossiiId: action.payload,
        };

      case 'CLEAR_ALL': {
        saveHossiis([]);
        return {
          ...state,
          hossiis: [],
          selectedHossiiId: null,
        };
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
        saveSpaces(action.payload);
        return {
          ...state,
          spaces: action.payload,
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
        return {
          ...state,
          hossiis: action.payload,
        };
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

      case 'SET_SHOW_HOSSII': {
        saveShowHossii(action.payload);
        return {
          ...state,
          showHossii: action.payload,
        };
      }

      case 'SET_LISTEN_MODE': {
        saveListenMode(action.payload);
        return {
          ...state,
          listenMode: action.payload,
        };
      }

      case 'SET_LISTEN_CONSENT': {
        saveListenConsent(action.payload);
        return {
          ...state,
          hasConsentedToListen: action.payload,
        };
      }

      case 'SET_EMOTION_LOG_ENABLED': {
        saveEmotionLogEnabled(action.payload);
        return {
          ...state,
          emotionLogEnabled: action.payload,
        };
      }

      case 'SET_SPEECH_LOG_ENABLED': {
        saveSpeechLogEnabled(action.payload);
        return {
          ...state,
          speechLogEnabled: action.payload,
        };
      }

      case 'SET_SPEECH_LEVELS': {
        saveSpeechLevels(action.payload);
        return {
          ...state,
          speechLevels: action.payload,
        };
      }

      case 'SET_DISPLAY_SCALE': {
        saveDisplayScale(action.payload);
        return {
          ...state,
          displayScale: action.payload,
        };
      }

      default:
        return state;
    }
  };
};

type HossiiContextValue = {
  state: ExtendedHossiiState;
  spacesLoadedFromSupabase: boolean;
  addHossii: (input: AddHossiiInput) => void;
  selectHossii: (id: string | null) => void;
  clearAll: () => void;
  setActiveSpace: (id: SpaceId) => void;
  getActiveSpace: () => Space | undefined;
  getActiveSpaceHossiis: () => Hossii[];
  addSpace: (space: Space) => void;
  updateSpace: (id: SpaceId, patch: Partial<Space>) => void;
  removeSpace: (id: SpaceId) => void;
  setMode: (mode: AppMode) => void;
  setDefaultNickname: (nickname: string) => void;
  setSpaceNickname: (spaceId: string, nickname: string) => void;
  getActiveNickname: () => string;
  hasNicknameForSpace: (spaceId: string) => boolean;
  setShowHossii: (show: boolean) => void;
  setListenMode: (enabled: boolean) => void;
  setListenConsent: (consented: boolean) => void;
  setEmotionLogEnabled: (enabled: boolean) => void;
  setSpeechLogEnabled: (enabled: boolean) => void;
  setSpeechLevels: (levels: SpeechLevelSettings) => void;
  setDisplayScale: (scale: DisplayScale) => void;
};

const HossiiContext = createContext<HossiiContextValue | null>(null);

type HossiiProviderProps = {
  children: ReactNode;
  initialHossiis?: Hossii[];
};

export const HossiiProvider = ({ children, initialHossiis = [] }: HossiiProviderProps) => {
  const { spaces, activeSpaceId } = useMemo(() => initializeSpaces(), []);
  const initialMode = useMemo(() => loadMode(), []);
  const initialProfile = useMemo(() => loadProfile(), []);
  const initialSpaceNicknames = useMemo(() => loadSpaceNicknames(), []);
  const initialShowHossii = useMemo(() => loadShowHossii(), []);
  const initialListenMode = useMemo(() => loadListenMode(), []);
  const initialListenConsent = useMemo(() => loadListenConsent(), []);
  const initialEmotionLogEnabled = useMemo(() => loadEmotionLogEnabled(), []);
  const initialSpeechLogEnabled = useMemo(() => loadSpeechLogEnabled(), []);
  const initialSpeechLevels = useMemo(() => loadSpeechLevels(), []);
  const initialDisplayScale = useMemo(() => loadDisplayScale(), []);

  const activeSpaceIdRef = useMemo(() => ({ current: activeSpaceId }), [activeSpaceId]);

  const reducer = useMemo(() => createReducer(activeSpaceIdRef), [activeSpaceIdRef]);

  const initialHossiisFromStorage = useMemo(
    () => initializeHossiis(activeSpaceId, initialHossiis),
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
    showHossii: initialShowHossii,
    listenMode: initialListenMode,
    hasConsentedToListen: initialListenConsent,
    emotionLogEnabled: initialEmotionLogEnabled,
    speechLogEnabled: initialSpeechLogEnabled,
    speechLevels: initialSpeechLevels,
    displayScale: initialDisplayScale,
  });

  // 自分が Supabase に INSERT した ID を追跡（Realtime 重複回避）
  const insertedHossiiIdsRef = useRef<Set<string>>(new Set());

  // 最新の state を ref で保持（コールバック内でのクロージャ問題を回避）
  const stateRef = useRef(state);
  stateRef.current = state;

  // Supabase からのスペース読み込みが完了したかどうか
  // Supabase 未設定の場合は localStorage のみを使うため即 true
  const [spacesLoadedFromSupabase, setSpacesLoadedFromSupabase] = useState(!isSupabaseConfigured);

  // ===== Supabase: スペースをマウント時に同期 =====
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    fetchSpaces().then((supabaseSpaces) => {
      if (supabaseSpaces.length > 0) {
        dispatch({ type: 'SET_SPACES', payload: supabaseSpaces });
      }
      setSpacesLoadedFromSupabase(true);
    });
  }, []);

  // ===== Supabase: アクティブスペースの hossiis を同期 =====
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    fetchHossiis(state.activeSpaceId).then((supabaseHossiis) => {
      if (supabaseHossiis.length > 0) {
        dispatch({ type: 'SYNC_HOSSIIS', payload: supabaseHossiis });
      }
    });
  }, [state.activeSpaceId]);

  // ===== Supabase Realtime: hossiis の INSERT/DELETE を購読 =====
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const activeSpaceId = state.activeSpaceId;

    const channel = supabase
      .channel(`hossiis:${activeSpaceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'hossiis',
          filter: `space_id=eq.${activeSpaceId}`,
        },
        (payload) => {
          const row = payload.new as HossiiRow;
          // 自分が INSERT した場合はスキップ（楽観的更新で既に追加済み）
          if (insertedHossiiIdsRef.current.has(row.id)) {
            insertedHossiiIdsRef.current.delete(row.id);
            return;
          }
          dispatch({ type: 'ADD_HOSSII_FULL', payload: rowToHossii(row) });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'hossiis',
          filter: `space_id=eq.${activeSpaceId}`,
        },
        (payload) => {
          const id = (payload.old as { id: string }).id;
          dispatch({ type: 'REMOVE_HOSSII', payload: id });
        }
      )
      .subscribe();

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
    if (!input.emotion && !msg && !isLaughter) return;

    const currentState = stateRef.current;

    // プロフィールが無ければ作成
    let profile = currentState.profile;
    if (!profile) {
      profile = {
        id: generateId(),
        defaultNickname: '',
        createdAt: new Date(),
      };
      dispatch({ type: 'SET_PROFILE', payload: profile });
      saveProfile(profile);
    }

    const authorName =
      input.authorNameOverride ??
      (getActiveNicknameFromState(currentState) || undefined);

    const newHossii: Hossii = {
      id: generateId(),
      message: msg,
      emotion: input.emotion,
      spaceId: activeSpaceIdRef.current,
      authorId: input.authorNameOverride ? undefined : profile.id,
      authorName,
      createdAt: new Date(),
      logType: input.logType,
      speechLevel: input.speechLevel,
      origin: input.origin,
      autoType: input.autoType,
      language: input.language,
    };

    // 楽観的更新（即時 UI 反映）
    dispatch({ type: 'ADD_HOSSII_FULL', payload: newHossii });

    // Supabase に非同期 INSERT
    if (isSupabaseConfigured) {
      insertedHossiiIdsRef.current.add(newHossii.id);
      insertHossii(newHossii);
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

  const getActiveSpaceHossiis = useCallback(() => {
    return state.hossiis.filter((h) => h.spaceId === state.activeSpaceId);
  }, [state.hossiis, state.activeSpaceId]);

  const addSpace = useCallback((space: Space) => {
    dispatch({ type: 'ADD_SPACE', payload: space });
    if (isSupabaseConfigured) {
      insertSpace(space);
    }
  }, []);

  const updateSpace = useCallback((id: SpaceId, patch: Partial<Space>) => {
    dispatch({ type: 'UPDATE_SPACE', payload: { id, patch } });
    if (isSupabaseConfigured) {
      updateSpaceInDb(id, patch);
    }
  }, []);

  const removeSpace = useCallback((id: SpaceId) => {
    dispatch({ type: 'REMOVE_SPACE', payload: id });
    if (isSupabaseConfigured) {
      deleteSpaceFromDb(id);
    }
  }, []);

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
    // ログイン済みの場合のみ Supabase に同期（認証実装後に条件追加）
    if (isSupabaseConfigured) {
      const profile = stateRef.current.profile;
      if (profile) {
        upsertSpaceNickname(profile.id, spaceId, nickname.trim());
      }
    }
  }, []);

  const getActiveNickname = useCallback(() => {
    return getActiveNicknameFromState(state);
  }, [state]);

  const hasNicknameForSpace = useCallback((spaceId: string) => {
    return !!state.spaceNicknames[spaceId];
  }, [state.spaceNicknames]);

  const setShowHossii = useCallback((show: boolean) => {
    dispatch({ type: 'SET_SHOW_HOSSII', payload: show });
  }, []);

  const setListenMode = useCallback((enabled: boolean) => {
    dispatch({ type: 'SET_LISTEN_MODE', payload: enabled });
  }, []);

  const setListenConsent = useCallback((consented: boolean) => {
    dispatch({ type: 'SET_LISTEN_CONSENT', payload: consented });
  }, []);

  const setEmotionLogEnabled = useCallback((enabled: boolean) => {
    dispatch({ type: 'SET_EMOTION_LOG_ENABLED', payload: enabled });
  }, []);

  const setSpeechLogEnabled = useCallback((enabled: boolean) => {
    dispatch({ type: 'SET_SPEECH_LOG_ENABLED', payload: enabled });
  }, []);

  const setSpeechLevels = useCallback((levels: SpeechLevelSettings) => {
    dispatch({ type: 'SET_SPEECH_LEVELS', payload: levels });
  }, []);

  const setDisplayScale = useCallback((scale: DisplayScale) => {
    dispatch({ type: 'SET_DISPLAY_SCALE', payload: scale });
  }, []);

  return (
    <HossiiContext.Provider
      value={{
        state,
        spacesLoadedFromSupabase,
        addHossii,
        selectHossii,
        clearAll,
        setActiveSpace,
        getActiveSpace,
        getActiveSpaceHossiis,
        addSpace,
        updateSpace,
        removeSpace,
        setMode,
        setDefaultNickname,
        setSpaceNickname,
        getActiveNickname,
        hasNicknameForSpace,
        setShowHossii,
        setListenMode,
        setListenConsent,
        setEmotionLogEnabled,
        setSpeechLogEnabled,
        setSpeechLevels,
        setDisplayScale,
      }}
    >
      {children}
    </HossiiContext.Provider>
  );
};

export const useHossiiStore = (): HossiiContextValue => {
  const context = useContext(HossiiContext);
  if (!context) {
    throw new Error('useHossiiStore must be used within a HossiiProvider');
  }
  return context;
};
