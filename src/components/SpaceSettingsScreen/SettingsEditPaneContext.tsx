import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { SpacePane } from '../../core/types/spacePane';
import type { SpaceSettings } from '../../core/types/settings';
import type { Space, SpaceUpdatePatch } from '../../core/types/space';
import { useSpacePane } from '../../core/hooks/SpacePaneProvider';
import {
  loadSettingsEditPaneId,
  saveSettingsEditPaneId,
} from '../../core/utils/settingsEditPaneStorage';
import type { PaneSettingSaveContext } from '../../core/utils/savePaneSettingOverride';
import { isAdditionalPane } from '../../core/utils/paneOverrideFields';

type SettingsEditPaneContextValue = {
  editPane: SpacePane | null;
  isAdditionalEditPane: boolean;
  requestEditPaneChange: (paneId: string) => boolean;
  saveContext: PaneSettingSaveContext | null;
};

const SettingsEditPaneContext = createContext<SettingsEditPaneContextValue | null>(null);

type ProviderProps = {
  space: Space;
  settings: SpaceSettings;
  screenDirty: boolean;
  onUpdateSpace: (patch: SpaceUpdatePatch) => void;
  onUpdateSettings: (settings: SpaceSettings) => void;
  children: ReactNode;
};

export function SettingsEditPaneProvider({
  space,
  settings,
  screenDirty,
  onUpdateSpace,
  onUpdateSettings,
  children,
}: ProviderProps) {
  const { panes, defaultPane, reloadPanesAndSyncActive } = useSpacePane();

  const [editPaneId, setEditPaneId] = useState<string | null>(() => {
    const stored = loadSettingsEditPaneId(space.id);
    if (stored && panes.some((p) => p.id === stored)) return stored;
    return defaultPane?.id ?? panes[0]?.id ?? null;
  });

  useEffect(() => {
    if (editPaneId && panes.some((p) => p.id === editPaneId)) return;
    const fallback = defaultPane?.id ?? panes[0]?.id ?? null;
    if (fallback && fallback !== editPaneId) {
      setEditPaneId(fallback);
      saveSettingsEditPaneId(space.id, fallback);
    }
  }, [panes, defaultPane, editPaneId, space.id]);

  const editPane = useMemo(
    () => panes.find((p) => p.id === editPaneId) ?? defaultPane ?? panes[0] ?? null,
    [panes, editPaneId, defaultPane],
  );

  const requestEditPaneChange = useCallback(
    (paneId: string): boolean => {
      if (paneId === editPaneId) return true;
      if (
        screenDirty &&
        !window.confirm(
          '変更が保存されていません。\nこのままタブを切り替えると変更が失われます。\n\n変更を破棄して切り替えますか？',
        )
      ) {
        return false;
      }
      setEditPaneId(paneId);
      saveSettingsEditPaneId(space.id, paneId);
      return true;
    },
    [editPaneId, screenDirty, space.id],
  );

  const saveContext = useMemo((): PaneSettingSaveContext | null => {
    if (!editPane) return null;
    return {
      editPane,
      space,
      settings,
      onUpdateSpace,
      onUpdateSettings,
      reloadPanesAndSyncActive,
    };
  }, [editPane, space, settings, onUpdateSpace, onUpdateSettings, reloadPanesAndSyncActive]);

  const value = useMemo(
    (): SettingsEditPaneContextValue => ({
      editPane,
      isAdditionalEditPane: editPane != null && isAdditionalPane(editPane),
      requestEditPaneChange,
      saveContext,
    }),
    [editPane, requestEditPaneChange, saveContext],
  );

  return (
    <SettingsEditPaneContext.Provider value={value}>
      {children}
    </SettingsEditPaneContext.Provider>
  );
}

export function useSettingsEditPane(): SettingsEditPaneContextValue {
  const ctx = useContext(SettingsEditPaneContext);
  if (!ctx) {
    throw new Error('useSettingsEditPane must be used within SettingsEditPaneProvider');
  }
  return ctx;
}

/** Optional hook for tabs outside override provider scope (should not happen). */
export function useSettingsEditPaneOptional(): SettingsEditPaneContextValue | null {
  return useContext(SettingsEditPaneContext);
}
