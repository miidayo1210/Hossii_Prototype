import { useReducer, useCallback, createContext, useContext, useMemo, useEffect, type ReactNode } from 'react';
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
  getHossiisStorageKey,
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
    language: raw.language as Hossii['language'], // undefined for old logs
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

  // id: 必須（無ければ生成）
  const id = typeof raw.id === 'string' && raw.id ? raw.id : generateId();

  // name: 無ければフォールバック
  const name = typeof raw.name === 'string' && raw.name ? raw.name : 'My Space';

  // cardType: 不正なら 'constellation'
  const cardType = isValidCardType(raw.cardType) ? raw.cardType : 'constellation';

  // quickEmotions: 無い or 8個超ならデフォルト
  let quickEmotions = DEFAULT_QUICK_EMOTIONS;
  if (Array.isArray(raw.quickEmotions) && raw.quickEmotions.length > 0 && raw.quickEmotions.length <= 8) {
    quickEmotions = raw.quickEmotions as Space['quickEmotions'];
  }
  // 旧形式 allowedEmotions からの移行対応
  if (Array.isArray(raw.allowedEmotions) && raw.allowedEmotions.length > 0 && raw.allowedEmotions.length <= 8) {
    quickEmotions = raw.allowedEmotions as Space['quickEmotions'];
  }

  // createdAt: 無効なら現在時刻
  let createdAt: Date;
  if (raw.createdAt instanceof Date) {
    createdAt = raw.createdAt;
  } else if (typeof raw.createdAt === 'string') {
    const parsed = new Date(raw.createdAt);
    createdAt = isNaN(parsed.getTime()) ? new Date() : parsed;
  } else {
    createdAt = new Date();
  }

  // background: 無い or 不正ならデフォルト背景
  const background = isValidBackground(raw.background)
    ? (raw.background as SpaceBackground)
    : DEFAULT_BACKGROUND;

  return { id, name, cardType, quickEmotions, createdAt, background };
};

// 初期化: localStorage からスペースを読み込み、なければデフォルトスペースを作成
function initializeSpaces(): { spaces: Space[]; activeSpaceId: SpaceId } {
  let spaces: Space[] = [];

  try {
    const loaded = loadSpaces();
    spaces = loaded.map(normalizeSpace);
  } catch {
    // localStorage が壊れていても落ちない
    spaces = [];
  }

  // スペースがなければデフォルトスペースを作成
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

  // アクティブスペースがなければ最初のスペースを選択
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

      // マイグレーションが必要かチェック（バージョン管理で一度だけ実行）
      if (needsMigration()) {
        const migrated = normalized.map(migrateHossiiOrigin);
        // 変更があれば保存
        const hasChanges = migrated.some((h, i) =>
          h.origin !== normalized[i].origin ||
          h.autoType !== normalized[i].autoType ||
          h.message !== normalized[i].message
        );
        if (hasChanges) {
          saveHossiis(migrated);
        }
        // マイグレーション完了を記録
        markMigrationComplete();
        return migrated;
      }

      return normalized;
    }
  } catch {
    // ignore
  }
  // localStorage になければ initialHossiis を使用
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
  | { type: 'SET_ACTIVE_SPACE'; payload: SpaceId }
  | { type: 'ADD_SPACE'; payload: Space }
  | { type: 'UPDATE_SPACE'; payload: { id: SpaceId; patch: Partial<Space> } }
  | { type: 'REMOVE_SPACE'; payload: SpaceId }
  | { type: 'SYNC_HOSSIIS'; payload: Hossii[] }
  | { type: 'SET_MODE'; payload: AppMode }
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
        // 空投稿防止：emotion も message も無い場合は追加しない
        // ただし laughter は空メッセージを許可
        const msg = (action.payload.message ?? '').trim();
        const isLaughter = action.payload.autoType === 'laughter';
        if (!action.payload.emotion && !msg && !isLaughter) {
          return state;
        }

        // プロフィールが無ければ作成（authorId用）
        let currentProfile = state.profile;
        if (!currentProfile) {
          currentProfile = {
            id: generateId(),
            defaultNickname: '',
            createdAt: new Date(),
          };
          saveProfile(currentProfile);
        }

        // authorNameOverride があればそれを使用、なければアクティブなニックネーム
        const authorName = action.payload.authorNameOverride ?? (getActiveNicknameFromState(state) || undefined);
        const newHossii: Hossii = {
          id: generateId(),
          message: msg,
          emotion: action.payload.emotion,
          spaceId: activeSpaceIdRef.current,
          authorId: action.payload.authorNameOverride ? undefined : currentProfile.id, // Hossii投稿はauthorIdなし
          authorName,
          createdAt: new Date(),
          logType: action.payload.logType,
          speechLevel: action.payload.speechLevel,
          origin: action.payload.origin,
          autoType: action.payload.autoType,
          language: action.payload.language,
        };
        const newHossiis = [...state.hossiis, newHossii];
        // localStorage に保存
        saveHossiis(newHossiis);
        return {
          ...state,
          profile: currentProfile,
          hossiis: newHossiis,
        };
      }

      case 'SELECT_HOSSII':
        return {
          ...state,
          selectedHossiiId: action.payload,
        };

      case 'CLEAR_ALL': {
        // localStorage もクリア
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

        // スペースが1つも無くなった場合、デフォルトスペースを作成
        let newSpaces: Space[];
        if (remainingSpaces.length === 0) {
          newSpaces = [DEFAULT_SPACE];
        } else {
          newSpaces = remainingSpaces;
        }

        // 削除対象が現在アクティブなスペースだった場合、先頭のスペースに切り替え
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
        // 他タブからの同期
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

      case 'SET_DEFAULT_NICKNAME': {
        const nickname = action.payload.trim();
        let profile = state.profile;
        if (!profile) {
          // プロフィールが無ければ作成
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
  // スペースの初期化
  const { spaces, activeSpaceId } = useMemo(() => initializeSpaces(), []);

  // モードの初期化
  const initialMode = useMemo(() => loadMode(), []);

  // プロフィールの初期化
  const initialProfile = useMemo(() => loadProfile(), []);

  // スペースごとのニックネームの初期化
  const initialSpaceNicknames = useMemo(() => loadSpaceNicknames(), []);

  // showHossii の初期化
  const initialShowHossii = useMemo(() => loadShowHossii(), []);

  // listenMode の初期化
  const initialListenMode = useMemo(() => loadListenMode(), []);
  const initialListenConsent = useMemo(() => loadListenConsent(), []);

  // 音声ログ設定の初期化
  const initialEmotionLogEnabled = useMemo(() => loadEmotionLogEnabled(), []);
  const initialSpeechLogEnabled = useMemo(() => loadSpeechLogEnabled(), []);
  const initialSpeechLevels = useMemo(() => loadSpeechLevels(), []);

  // ディスプレイスケール設定の初期化
  const initialDisplayScale = useMemo(() => loadDisplayScale(), []);

  // activeSpaceId を ref で保持（reducer 内で参照するため）
  const activeSpaceIdRef = useMemo(() => ({ current: activeSpaceId }), [activeSpaceId]);

  // reducer を作成
  const reducer = useMemo(() => createReducer(activeSpaceIdRef), [activeSpaceIdRef]);

  // hossiis を localStorage から読み込み
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

  // 他タブからの storage イベントを監視
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === getHossiisStorageKey() && e.newValue) {
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

  const addHossii = useCallback((input: AddHossiiInput) => {
    dispatch({ type: 'ADD_HOSSII', payload: input });
  }, []);

  const selectHossii = useCallback((id: string | null) => {
    dispatch({ type: 'SELECT_HOSSII', payload: id });
  }, []);

  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
  }, []);

  const setActiveSpace = useCallback((id: SpaceId) => {
    dispatch({ type: 'SET_ACTIVE_SPACE', payload: id });
  }, []);

  const getActiveSpace = useCallback(() => {
    return state.spaces.find((f) => f.id === state.activeSpaceId);
  }, [state.spaces, state.activeSpaceId]);

  // アクティブなスペースのログのみを取得
  const getActiveSpaceHossiis = useCallback(() => {
    return state.hossiis.filter((h) => h.spaceId === state.activeSpaceId);
  }, [state.hossiis, state.activeSpaceId]);

  // スペースを追加
  const addSpace = useCallback((space: Space) => {
    dispatch({ type: 'ADD_SPACE', payload: space });
  }, []);

  // スペースを更新
  const updateSpace = useCallback((id: SpaceId, patch: Partial<Space>) => {
    dispatch({ type: 'UPDATE_SPACE', payload: { id, patch } });
  }, []);

  // スペースを削除
  const removeSpace = useCallback((id: SpaceId) => {
    dispatch({ type: 'REMOVE_SPACE', payload: id });
  }, []);

  // モードを変更
  const setMode = useCallback((mode: AppMode) => {
    dispatch({ type: 'SET_MODE', payload: mode });
  }, []);

  // デフォルトニックネームを設定
  const setDefaultNickname = useCallback((nickname: string) => {
    dispatch({ type: 'SET_DEFAULT_NICKNAME', payload: nickname });
  }, []);

  // スペースごとのニックネームを設定
  const setSpaceNickname = useCallback((spaceId: string, nickname: string) => {
    dispatch({ type: 'SET_SPACE_NICKNAME', payload: { spaceId, nickname } });
  }, []);

  // アクティブなニックネームを取得
  const getActiveNickname = useCallback(() => {
    return getActiveNicknameFromState(state);
  }, [state]);

  // スペースに対してニックネームが設定されているか
  const hasNicknameForSpace = useCallback((spaceId: string) => {
    return !!state.spaceNicknames[spaceId];
  }, [state.spaceNicknames]);

  // Hossii 表示切替
  const setShowHossii = useCallback((show: boolean) => {
    dispatch({ type: 'SET_SHOW_HOSSII', payload: show });
  }, []);

  // Listen モード切替
  const setListenMode = useCallback((enabled: boolean) => {
    dispatch({ type: 'SET_LISTEN_MODE', payload: enabled });
  }, []);

  // Listen 同意設定
  const setListenConsent = useCallback((consented: boolean) => {
    dispatch({ type: 'SET_LISTEN_CONSENT', payload: consented });
  }, []);

  // 感情ログ有効/無効
  const setEmotionLogEnabled = useCallback((enabled: boolean) => {
    dispatch({ type: 'SET_EMOTION_LOG_ENABLED', payload: enabled });
  }, []);

  // 音声ログ有効/無効
  const setSpeechLogEnabled = useCallback((enabled: boolean) => {
    dispatch({ type: 'SET_SPEECH_LOG_ENABLED', payload: enabled });
  }, []);

  // 音声ログ粒度設定
  const setSpeechLevels = useCallback((levels: SpeechLevelSettings) => {
    dispatch({ type: 'SET_SPEECH_LEVELS', payload: levels });
  }, []);

  // ディスプレイスケール設定
  const setDisplayScale = useCallback((scale: DisplayScale) => {
    dispatch({ type: 'SET_DISPLAY_SCALE', payload: scale });
  }, []);

  return (
    <HossiiContext.Provider
      value={{
        state,
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
