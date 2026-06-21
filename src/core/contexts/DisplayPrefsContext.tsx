import { createContext, useContext, useReducer, useCallback, useMemo, type ReactNode } from 'react';
import { loadShowHossii, saveShowHossii } from '../utils/hossiiDisplayStorage';
import {
  loadListenMode, saveListenMode,
  loadListenConsent, saveListenConsent,
  loadEmotionLogEnabled, saveEmotionLogEnabled,
  loadSpeechLevels, saveSpeechLevels,
  type SpeechLevelSettings,
} from '../utils/listenStorage';
import {
  loadVoiceEnabled, saveVoiceEnabled,
  loadVoiceConsent, saveVoiceConsent,
} from '../utils/voiceStorage';
import { loadDisplayScale, saveDisplayScale, type DisplayScale } from '../utils/displayScaleStorage';
import {
  loadDisplayPeriod, saveDisplayPeriod,
  loadDisplayLimit, saveDisplayLimit,
  loadViewMode, saveViewMode,
  loadLayoutMode, saveLayoutMode,
  loadOrderedSortDirection, saveOrderedSortDirection,
  loadAuthorGroupSort, saveAuthorGroupSort,
  type DisplayPeriod,
  type DisplayLimit,
  type ViewMode,
  type LayoutMode,
  type OrderedSortDirection,
  type AuthorGroupSort,
} from '../utils/displayPrefsStorage';

// ===== State =====

export type DisplayPrefsState = {
  showHossii: boolean;
  listenMode: boolean;
  hasConsentedToListen: boolean;
  voiceEnabled: boolean;
  hasConsentedToVoice: boolean;
  emotionLogEnabled: boolean;
  speechLevels: SpeechLevelSettings;
  displayScale: DisplayScale;
  displayPeriod: DisplayPeriod;
  displayLimit: DisplayLimit;
  viewMode: ViewMode;
  layoutMode: LayoutMode;
  orderedSortDirection: OrderedSortDirection;
  authorGroupSort: AuthorGroupSort;
};

// ===== Actions =====

type DisplayPrefsAction =
  | { type: 'SET_SHOW_HOSSII'; payload: boolean }
  | { type: 'SET_LISTEN_MODE'; payload: boolean }
  | { type: 'SET_LISTEN_CONSENT'; payload: boolean }
  | { type: 'SET_VOICE_ENABLED'; payload: boolean }
  | { type: 'SET_VOICE_CONSENT'; payload: boolean }
  | { type: 'SET_EMOTION_LOG_ENABLED'; payload: boolean }
  | { type: 'SET_SPEECH_LEVELS'; payload: SpeechLevelSettings }
  | { type: 'SET_DISPLAY_SCALE'; payload: DisplayScale }
  | { type: 'SET_DISPLAY_PERIOD'; payload: DisplayPeriod }
  | { type: 'SET_DISPLAY_LIMIT'; payload: DisplayLimit }
  | { type: 'SET_VIEW_MODE'; payload: ViewMode }
  | { type: 'SET_LAYOUT_MODE'; payload: LayoutMode }
  | { type: 'SET_ORDERED_SORT_DIRECTION'; payload: OrderedSortDirection }
  | { type: 'SET_AUTHOR_GROUP_SORT'; payload: AuthorGroupSort };

// ===== Reducer =====

function displayPrefsReducer(state: DisplayPrefsState, action: DisplayPrefsAction): DisplayPrefsState {
  switch (action.type) {
    case 'SET_SHOW_HOSSII':
      saveShowHossii(action.payload);
      return { ...state, showHossii: action.payload };
    case 'SET_LISTEN_MODE':
      saveListenMode(action.payload);
      return { ...state, listenMode: action.payload };
    case 'SET_LISTEN_CONSENT':
      saveListenConsent(action.payload);
      return { ...state, hasConsentedToListen: action.payload };
    case 'SET_VOICE_ENABLED':
      saveVoiceEnabled(action.payload);
      return { ...state, voiceEnabled: action.payload };
    case 'SET_VOICE_CONSENT':
      saveVoiceConsent(action.payload);
      return { ...state, hasConsentedToVoice: action.payload };
    case 'SET_EMOTION_LOG_ENABLED':
      saveEmotionLogEnabled(action.payload);
      return { ...state, emotionLogEnabled: action.payload };
    case 'SET_SPEECH_LEVELS':
      saveSpeechLevels(action.payload);
      return { ...state, speechLevels: action.payload };
    case 'SET_DISPLAY_SCALE':
      saveDisplayScale(action.payload);
      return { ...state, displayScale: action.payload };
    case 'SET_DISPLAY_PERIOD':
      saveDisplayPeriod(action.payload);
      return { ...state, displayPeriod: action.payload };
    case 'SET_DISPLAY_LIMIT':
      saveDisplayLimit(action.payload);
      return { ...state, displayLimit: action.payload };
    case 'SET_VIEW_MODE':
      saveViewMode(action.payload);
      return { ...state, viewMode: action.payload };
    case 'SET_LAYOUT_MODE':
      saveLayoutMode(action.payload);
      return { ...state, layoutMode: action.payload };
    case 'SET_ORDERED_SORT_DIRECTION':
      saveOrderedSortDirection(action.payload);
      return { ...state, orderedSortDirection: action.payload };
    case 'SET_AUTHOR_GROUP_SORT':
      saveAuthorGroupSort(action.payload);
      return { ...state, authorGroupSort: action.payload };
    default:
      return state;
  }
}

// ===== Context type =====

export type DisplayPrefsContextType = {
  prefs: DisplayPrefsState;
  setShowHossii: (show: boolean) => void;
  setListenMode: (enabled: boolean) => void;
  setListenConsent: (consented: boolean) => void;
  setVoiceEnabled: (enabled: boolean) => void;
  setVoiceConsent: (consented: boolean) => void;
  setEmotionLogEnabled: (enabled: boolean) => void;
  setSpeechLevels: (levels: SpeechLevelSettings) => void;
  setDisplayScale: (scale: DisplayScale) => void;
  setDisplayPeriod: (period: DisplayPeriod) => void;
  setDisplayLimit: (limit: DisplayLimit) => void;
  setViewMode: (mode: ViewMode) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  setOrderedSortDirection: (direction: OrderedSortDirection) => void;
  setAuthorGroupSort: (sort: AuthorGroupSort) => void;
};

// ===== Context =====

// eslint-disable-next-line react-refresh/only-export-components
export const DisplayPrefsContext = createContext<DisplayPrefsContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useDisplayPrefs = () => {
  const ctx = useContext(DisplayPrefsContext);
  if (!ctx) throw new Error('useDisplayPrefs must be used within a DisplayPrefsProvider');
  return ctx;
};

// ===== Provider =====

export const DisplayPrefsProvider = ({ children }: { children: ReactNode }) => {
  const [prefs, dispatch] = useReducer(displayPrefsReducer, undefined, () => ({
    showHossii: loadShowHossii(),
    listenMode: loadListenMode(),
    hasConsentedToListen: loadListenConsent(),
    voiceEnabled: loadVoiceEnabled(),
    hasConsentedToVoice: loadVoiceConsent(),
    emotionLogEnabled: loadEmotionLogEnabled(),
    speechLevels: loadSpeechLevels(),
    displayScale: loadDisplayScale(),
    displayPeriod: loadDisplayPeriod(),
    displayLimit: loadDisplayLimit(),
    viewMode: loadViewMode(),
    layoutMode: loadLayoutMode(),
    orderedSortDirection: loadOrderedSortDirection(),
    authorGroupSort: loadAuthorGroupSort(),
  }));

  const setShowHossii = useCallback((show: boolean) => dispatch({ type: 'SET_SHOW_HOSSII', payload: show }), []);
  const setListenMode = useCallback((enabled: boolean) => dispatch({ type: 'SET_LISTEN_MODE', payload: enabled }), []);
  const setListenConsent = useCallback((consented: boolean) => dispatch({ type: 'SET_LISTEN_CONSENT', payload: consented }), []);
  const setVoiceEnabled = useCallback((enabled: boolean) => dispatch({ type: 'SET_VOICE_ENABLED', payload: enabled }), []);
  const setVoiceConsent = useCallback((consented: boolean) => dispatch({ type: 'SET_VOICE_CONSENT', payload: consented }), []);
  const setEmotionLogEnabled = useCallback((enabled: boolean) => dispatch({ type: 'SET_EMOTION_LOG_ENABLED', payload: enabled }), []);
  const setSpeechLevels = useCallback((levels: SpeechLevelSettings) => dispatch({ type: 'SET_SPEECH_LEVELS', payload: levels }), []);
  const setDisplayScale = useCallback((scale: DisplayScale) => dispatch({ type: 'SET_DISPLAY_SCALE', payload: scale }), []);
  const setDisplayPeriod = useCallback((period: DisplayPeriod) => dispatch({ type: 'SET_DISPLAY_PERIOD', payload: period }), []);
  const setDisplayLimit = useCallback((limit: DisplayLimit) => dispatch({ type: 'SET_DISPLAY_LIMIT', payload: limit }), []);
  const setViewMode = useCallback((mode: ViewMode) => dispatch({ type: 'SET_VIEW_MODE', payload: mode }), []);
  const setLayoutMode = useCallback((mode: LayoutMode) => dispatch({ type: 'SET_LAYOUT_MODE', payload: mode }), []);
  const setOrderedSortDirection = useCallback(
    (direction: OrderedSortDirection) => dispatch({ type: 'SET_ORDERED_SORT_DIRECTION', payload: direction }),
    []
  );
  const setAuthorGroupSort = useCallback(
    (sort: AuthorGroupSort) => dispatch({ type: 'SET_AUTHOR_GROUP_SORT', payload: sort }),
    []
  );

  const value = useMemo<DisplayPrefsContextType>(() => ({
    prefs,
    setShowHossii,
    setListenMode,
    setListenConsent,
    setVoiceEnabled,
    setVoiceConsent,
    setEmotionLogEnabled,
    setSpeechLevels,
    setDisplayScale,
    setDisplayPeriod,
    setDisplayLimit,
    setViewMode,
    setLayoutMode,
    setOrderedSortDirection,
    setAuthorGroupSort,
  }), [
    prefs,
    setShowHossii,
    setListenMode,
    setListenConsent,
    setVoiceEnabled,
    setVoiceConsent,
    setEmotionLogEnabled,
    setSpeechLevels,
    setDisplayScale,
    setDisplayPeriod,
    setDisplayLimit,
    setViewMode,
    setLayoutMode,
    setOrderedSortDirection,
    setAuthorGroupSort,
  ]);

  return (
    <DisplayPrefsContext.Provider value={value}>
      {children}
    </DisplayPrefsContext.Provider>
  );
};
