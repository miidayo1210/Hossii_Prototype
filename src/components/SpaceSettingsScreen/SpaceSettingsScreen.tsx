import { useState, useEffect, useCallback } from 'react';
import { useRouter } from '../../core/hooks/useRouter';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { useAuth } from '../../core/contexts/useAuth';
import { loadSpaceSettings, saveSpaceSettings } from '../../core/utils/settingsStorage';
import { fetchSpaceSettings, upsertSpaceSettings } from '../../core/utils/spaceSettingsApi';
import type { SpaceSettings } from '../../core/types/settings';
import { DEFAULT_STAR_MARKER, DEFAULT_SPACE_MODE_STATE } from '../../core/types/settings';
import type { Space, SpaceUpdatePatch } from '../../core/types/space';
import { refreshModeCustomization } from '../../core/utils/spaceModeCustomize';
import { canManageSpace } from '../../core/utils/spaceAdminAccess';
import { SettingsLayout } from './SettingsLayout';
import { SpaceModeTab } from './SpaceModeTab';
import { BasicInfoTab } from './BasicInfoTab';
import { PublicShareTab } from './PublicShareTab';
import { PostFormTab } from './PostFormTab';
import { InteractionRulesTab } from './InteractionRulesTab';
import { TagsTab } from './TagsTab';
import { BackgroundTab } from './BackgroundTab';
import { AppearanceTab } from './AppearanceTab';
import { CharacterTab } from './CharacterTab';
import { DecorationTab } from './DecorationTab';
import { ModerationTab } from './ModerationTab';
import { ExportRecordTab } from './ExportRecordTab';
import { NeighborsTab } from './NeighborsTab';
import { ParticipantAccountsTab } from './ParticipantAccountsTab';
import { SpaceMembersTab } from './SpaceMembersTab';
import { PaneManagementTab } from './PaneManagementTab';
import { SettingsEditPaneProvider } from './SettingsEditPaneContext';
import {
  DEFAULT_SETTINGS_SCREEN,
  EXPLICIT_SAVE_SCREENS,
  type SettingsScreenId,
} from './settingsScreenIds';
import styles from './SpaceSettingsScreen.module.css';

export const SpaceSettingsScreen = () => {
  const { navigate } = useRouter();
  const { state, updateSpace } = useHossiiStore();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.isAdmin ?? false;

  const activeSpace = state.spaces.find((s) => s.id === state.activeSpaceId);
  const canManageActiveSpace = canManageSpace(currentUser, activeSpace);
  const [settingsSyncedSpaceId, setSettingsSyncedSpaceId] = useState<string | null>(null);
  const settingsDbSynced =
    activeSpace != null && settingsSyncedSpaceId === activeSpace.id;
  const [activeScreen, setActiveScreen] = useState<SettingsScreenId>(DEFAULT_SETTINGS_SCREEN);
  const [screenDirty, setScreenDirty] = useState(false);

  const [settings, setSettings] = useState<SpaceSettings | null>(() => {
    const spaceId = state.activeSpaceId;
    if (!spaceId) return null;
    const space = state.spaces.find((s) => s.id === spaceId);
    return loadSpaceSettings(spaceId, space?.name ?? '');
  });

  useEffect(() => {
    if (!activeSpace) return;
    fetchSpaceSettings(activeSpace.id, activeSpace.name).then((loaded) => {
      const local = loadSpaceSettings(activeSpace.id, activeSpace.name);
      const merged: SpaceSettings = {
        ...loaded,
        timelineDepthEnabled: loaded.timelineDepthEnabled,
        starMarkerType: loaded.starMarkerType ?? local.starMarkerType ?? DEFAULT_STAR_MARKER,
        posting: loaded.posting ?? local.posting,
        reflection: loaded.reflection ?? local.reflection,
        mode: loaded.mode ?? local.mode ?? DEFAULT_SPACE_MODE_STATE,
      };
      setSettings(merged);
      saveSpaceSettings(merged);
      setSettingsSyncedSpaceId(activeSpace.id);
    });
  }, [activeSpace?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDirtyChange = useCallback((dirty: boolean) => {
    setScreenDirty(dirty);
  }, []);

  const persistModeCustomization = useCallback((space: Space, current: SpaceSettings) => {
    const refreshed = refreshModeCustomization(space, current);
    if (!refreshed) return current;
    const next = { ...current, mode: refreshed };
    saveSpaceSettings(next);
    upsertSpaceSettings(next).catch((err) => {
      console.error('[SpaceSettingsScreen] mode customization sync failed', err);
    });
    return next;
  }, []);

  const handleSettingsUpdate = useCallback(
    (updated: SpaceSettings) => {
      if (!activeSpace) {
        setSettings(updated);
        return;
      }
      setSettings(persistModeCustomization(activeSpace, updated));
    },
    [activeSpace, persistModeCustomization],
  );

  const handleSpaceUpdate = useCallback(
    (patch: SpaceUpdatePatch) => {
      if (!activeSpace) return;
      updateSpace(activeSpace.id, patch);
      if (settings && patch.isPrivate !== undefined) {
        const updatedSpace = { ...activeSpace, isPrivate: patch.isPrivate };
        setSettings(persistModeCustomization(updatedSpace, settings));
      }
      if (settings && patch.accessMode !== undefined) {
        const updatedSpace = { ...activeSpace, accessMode: patch.accessMode };
        setSettings(persistModeCustomization(updatedSpace, settings));
      }
    },
    [activeSpace, settings, updateSpace, persistModeCustomization],
  );

  const handleNavigate = useCallback(
    (next: SettingsScreenId) => {
      if (
        screenDirty &&
        EXPLICIT_SAVE_SCREENS.has(activeScreen) &&
        !window.confirm(
          '変更が保存されていません。\nこのまま移動すると変更が失われます。\n\n変更を破棄して移動しますか？',
        )
      ) {
        return;
      }
      setScreenDirty(false);
      setActiveScreen(next);
    },
    [activeScreen, screenDirty],
  );

  const handleBack = () => {
    if (
      screenDirty &&
      EXPLICIT_SAVE_SCREENS.has(activeScreen) &&
      !window.confirm(
        '変更が保存されていません。\nこのまま移動すると変更が失われます。\n\n変更を破棄して移動しますか？',
      )
    ) {
      return;
    }
    navigate(isAdmin ? 'spaces' : 'screen');
  };

  if (!settings || !activeSpace) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>読み込み中...</div>
      </div>
    );
  }

  const renderScreen = () => {
    switch (activeScreen) {
      case 'spaceMode':
        return (
          <SpaceModeTab
            key={`mode-${activeSpace.id}`}
            space={activeSpace}
            settings={settings}
            onUpdateSpace={(patch) => updateSpace(activeSpace.id, patch)}
            onUpdateSettings={handleSettingsUpdate}
          />
        );
      case 'basicInfo':
        return (
          <BasicInfoTab
            key={`basic-${activeSpace.id}`}
            space={activeSpace}
            settings={settings}
            onUpdateSpace={handleSpaceUpdate}
            onUpdateSettings={handleSettingsUpdate}
            onDirtyChange={handleDirtyChange}
          />
        );
      case 'publicShare':
        return (
          <PublicShareTab
            key={`share-${activeSpace.id}`}
            space={activeSpace}
            onUpdateSpace={handleSpaceUpdate}
            onDirtyChange={handleDirtyChange}
          />
        );
      case 'postForm':
        return (
          <PostFormTab
            key={`postform-${activeSpace.id}`}
            settings={settings}
            onUpdate={handleSettingsUpdate}
            onDirtyChange={handleDirtyChange}
          />
        );
      case 'paneManagement':
        return (
          <PaneManagementTab
            key={`panes-${activeSpace.id}`}
            spaceId={activeSpace.id}
            spaceURL={activeSpace.spaceURL}
          />
        );
      case 'interactionRules':
        return (
          <InteractionRulesTab
            key={`rules-${activeSpace.id}`}
            settings={settings}
            onUpdate={handleSettingsUpdate}
            onDirtyChange={handleDirtyChange}
          />
        );
      case 'tags':
        return (
          <TagsTab
            space={activeSpace}
            onUpdateSpace={handleSpaceUpdate}
          />
        );
      case 'background':
        return (
          <BackgroundTab
            key={`bg-${activeSpace.id}`}
            space={activeSpace}
            onUpdateSpace={handleSpaceUpdate}
            onDirtyChange={handleDirtyChange}
          />
        );
      case 'appearance':
        return (
          <AppearanceTab
            key={`appearance-${activeSpace.id}`}
            space={activeSpace}
            settings={settings}
            canManageTimelineDepth={canManageActiveSpace}
            settingsDbSynced={settingsDbSynced}
            onUpdate={handleSettingsUpdate}
            onUpdateSpace={handleSpaceUpdate}
            onDirtyChange={handleDirtyChange}
          />
        );
      case 'character':
        return (
          <CharacterTab
            key={`char-${activeSpace.id}`}
            space={activeSpace}
            onUpdateSpace={handleSpaceUpdate}
            onDirtyChange={handleDirtyChange}
          />
        );
      case 'decoration':
        return (
          <DecorationTab
            key={`deco-${activeSpace.id}`}
            space={activeSpace}
            onDirtyChange={handleDirtyChange}
          />
        );
      case 'moderation':
        return <ModerationTab spaceId={activeSpace.id} space={activeSpace} />;
      case 'spaceMembers':
        return <SpaceMembersTab key={`members-${activeSpace.id}`} space={activeSpace} />;
      case 'exportRecord':
        return <ExportRecordTab />;
      case 'neighbors':
        return (
          <NeighborsTab
            settings={settings}
            onUpdate={handleSettingsUpdate}
            spaceId={activeSpace.id}
            communitySpaces={state.spaces}
          />
        );
      case 'participantAccounts':
        return <ParticipantAccountsTab space={activeSpace} />;
      default:
        return null;
    }
  };

  return (
    <SettingsEditPaneProvider
      space={activeSpace}
      settings={settings}
      screenDirty={screenDirty}
      onUpdateSpace={handleSpaceUpdate}
      onUpdateSettings={handleSettingsUpdate}
    >
      <SettingsLayout
        spaceName={activeSpace.name}
        activeScreen={activeScreen}
        isAdmin={isAdmin}
        onBack={handleBack}
        onNavigate={handleNavigate}
      >
        {renderScreen()}
      </SettingsLayout>
    </SettingsEditPaneProvider>
  );
};
