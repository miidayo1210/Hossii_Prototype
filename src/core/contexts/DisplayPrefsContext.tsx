import { createContext, useContext, useReducer, useCallback, useMemo, type ReactNode } from 'react';
import { loadShowHossii, saveShowHossii } from '../utils/hossiiDisplayStorage';
import {
  loadListenMode, saveListenMode,
  loadListenConsent, saveListenConsent,
  loadEmotionLogEnabled, saveEmotionLogEnabled,
  loadSpeechLogEnabled, saveSpeechLogEnabled,
  loadSpeechLevels, saveSpeechLevels,
  type SpeechLevelSettings,
} from '../utils/listenStorage';
import { loadDisplayScale, saveDisplayScale, type DisplayScale } from '../utils/displayScaleStorage';
import {
  loadDisplayPeriod, saveDisplayPeriod,
  loadDisplayLimit, saveDisplayLimit,
  loadViewMode, saveViewMode,
  type DisplayPeriod,
  type DisplayLimit,
  type ViewMode,
} from '../utils/displayPrefsStorage';

// ===== State =====

export type DisplayPrefsState = {
  showHossii: boolean;
  listenMode: boolean;
  hasConsentedToListen: boolean;
  emotionLogEnabled: boolean;
  speechLogEnabled: boolean;
  speechLevels: SpeechLevelSettings;
  displayScale: DisplayScale;
  displayPeriod: DisplayPeriod;
  displayLimit: DisplayLimit;
  viewMode: ViewMode;
};

// ===== Actions =====

type DisplayPrefsAction =
  | { type: 'SET_SHOW_HOSSII'; payload: boolean }
  | { type: 'SET_LISTEN_MODE'; payload: boolean }
  | { type: 'SET_LISTEN_CONSENT'; payload: boolean }
  | { type: 'SET_EMOTION_LOG_ENABLED'; payload: boolean }
  | { type: 'SET_SPEECH_LOG_ENABLED'; payload: boolean }
  | { type: 'SET_SPEECH_LEVELS'; payload: SpeechLevelSettings }
  | { type: 'SET_DISPLAY_SCALE'; payload: DisplayScale }
  | { type: 'SET_DISPLAY_PERIOD'; payload: DisplayPeriod }
  | { type: 'SET_DISPLAY_LIMIT'; payload: DisplayLimit }
  | { type: 'SET_VIEW_MODE'; payload: ViewMode };

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
    case 'SET_EMOTION_LOG_ENABLED':
      saveEmotionLogEnabled(action.payload);
      return { ...state, emotionLogEnabled: action.payload };
    case 'SET_SPEECH_LOG_ENABLED':
      saveSpeechLogEnabled(action.payload);
      return { ...state, speechLogEnabled: action.payload };
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
  setEmotionLogEnabled: (enabled: boolean) => void;
  setSpeechLogEnabled: (enabled: boolean) => void;
  setSpeechLevels: (levels: SpeechLevelSettings) => void;
  setDisplayScale: (scale: DisplayScale) => void;
  setDisplayPeriod: (period: DisplayPeriod) => void;
  setDisplayLimit: (limit: DisplayLimit) => void;
  setViewMode: (mode: ViewMode) => void;
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
    emotionLogEnabled: loadEmotionLogEnabled(),
    speechLogEnabled: loadSpeechLogEnabled(),
    speechLevels: loadSpeechLevels(),
    displayScale: loadDisplayScale(),
    displayPeriod: loadDisplayPeriod(),
    displayLimit: loadDisplayLimit(),
    viewMode: loadViewMode(),
  }));

  const setShowHossii = useCallback((show: boolean) => dispatch({ type: 'SET_SHOW_HOSSII', payload: show }), []);
  const setListenMode = useCallback((enabled: boolean) => dispatch({ type: 'SET_LISTEN_MODE', payload: enabled }), []);
  const setListenConsent = useCallback((consented: boolean) => dispatch({ type: 'SET_LISTEN_CONSENT', payload: consented }), []);
  const setEmotionLogEnabled = useCallback((enabled: boolean) => dispatch({ type: 'SET_EMOTION_LOG_ENABLED', payload: enabled }), []);
  const setSpeechLogEnabled = useCallback((enabled: boolean) => dispatch({ type: 'SET_SPEECH_LOG_ENABLED', payload: enabled }), []);
  const setSpeechLevels = useCallback((levels: SpeechLevelSettings) => dispatch({ type: 'SET_SPEECH_LEVELS', payload: levels }), []);
  const setDisplayScale = useCallback((scale: DisplayScale) => dispatch({ type: 'SET_DISPLAY_SCALE', payload: scale }), []);
  const setDisplayPeriod = useCallback((period: DisplayPeriod) => dispatch({ type: 'SET_DISPLAY_PERIOD', payload: period }), []);
  const setDisplayLimit = useCallback((limit: DisplayLimit) => dispatch({ type: 'SET_DISPLAY_LIMIT', payload: limit }), []);
  const setViewMode = useCallback((mode: ViewMode) => dispatch({ type: 'SET_VIEW_MODE', payload: mode }), []);

  const value = useMemo<DisplayPrefsContextType>(() => ({
    prefs,
    setShowHossii,
    setListenMode,
    setListenConsent,
    setEmotionLogEnabled,
    setSpeechLogEnabled,
    setSpeechLevels,
    setDisplayScale,
    setDisplayPeriod,
    setDisplayLimit,
    setViewMode,
  }), [
    prefs,
    setShowHossii,
    setListenMode,
    setListenConsent,
    setEmotionLogEnabled,
    setSpeechLogEnabled,
    setSpeechLevels,
    setDisplayScale,
    setDisplayPeriod,
    setDisplayLimit,
    setViewMode,
  ]);

  return (
    <DisplayPrefsContext.Provider value={value}>
      {children}
    </DisplayPrefsContext.Provider>
  );
};
