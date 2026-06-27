import { useEffect, useMemo, useState } from 'react';
import type { SpaceSettings, BubbleEditPermission } from '../../core/types/settings';
import { DEFAULT_POSTING_SETTINGS, DEFAULT_REFLECTION_SETTINGS } from '../../core/types/settings';
import { saveSpaceSettings } from '../../core/utils/settingsStorage';
import { upsertSpaceSettings } from '../../core/utils/spaceSettingsApi';
import { resolvePanePositionMode } from '../../core/utils/resolvePanePositionMode';
import { hasPanePositionModeOverride, isAdditionalPane } from '../../core/utils/paneOverrideFields';
import {
  PaneOverrideSaveError,
  resetPanePositionModeOverride,
  savePanePositionModeOverride,
} from '../../core/utils/savePaneSettingOverride';
import { useScreenDraft } from '../../core/hooks/useScreenDraft';
import { useSettingsEditPane } from './SettingsEditPaneContext';
import { PaneOverrideHint } from './PaneOverrideHint';
import { SettingsPageHeader } from './SettingsPageHeader';
import { SettingsSection } from './SettingsSection';
import { SettingsSaveBar } from './SettingsSaveBar';
import sharedStyles from './SettingsShared.module.css';
import formStyles from './GeneralTab.module.css';

type InteractionDraft = {
  likesEnabled: boolean;
  bubbleEditPermission: BubbleEditPermission;
  positionMode: 'auto' | 'selector';
  randomRecallEnabled: boolean;
};

type Props = {
  settings: SpaceSettings;
  onUpdate: (settings: SpaceSettings) => void;
  onDirtyChange: (dirty: boolean) => void;
};

function toDraft(settings: SpaceSettings, editPane: ReturnType<typeof useSettingsEditPane>['editPane']): InteractionDraft {
  return {
    likesEnabled: settings.features.likesEnabled,
    bubbleEditPermission: settings.bubbleEditPermission ?? 'all',
    positionMode: resolvePanePositionMode(editPane, settings),
    randomRecallEnabled: settings.reflection?.randomRecallEnabled ?? DEFAULT_REFLECTION_SETTINGS.randomRecallEnabled,
  };
}

export const InteractionRulesTab = ({ settings, onUpdate, onDirtyChange }: Props) => {
  const { editPane, saveContext } = useSettingsEditPane();
  const initial = useMemo(() => toDraft(settings, editPane), [settings, editPane]);
  const { draft, setDraft, isDirty, discard, commitSaved } = useScreenDraft(initial);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const hasPositionOverride =
    editPane != null && isAdditionalPane(editPane) && hasPanePositionModeOverride(editPane);

  const handleSave = async () => {
    if (!saveContext) return;
    setIsSaving(true);
    try {
      const spaceLevel: SpaceSettings = {
        ...settings,
        features: { ...settings.features, likesEnabled: draft.likesEnabled },
        bubbleEditPermission: draft.bubbleEditPermission,
        reflection: {
          ...(settings.reflection ?? DEFAULT_REFLECTION_SETTINGS),
          randomRecallEnabled: draft.randomRecallEnabled,
        },
        posting: saveContext.editPane.isDefault
          ? {
              ...(settings.posting ?? DEFAULT_POSTING_SETTINGS),
              positionMode: draft.positionMode,
            }
          : settings.posting ?? DEFAULT_POSTING_SETTINGS,
      };
      onUpdate(spaceLevel);
      saveSpaceSettings(spaceLevel);
      await upsertSpaceSettings(spaceLevel);

      if (!saveContext.editPane.isDefault) {
        await savePanePositionModeOverride(saveContext, draft.positionMode);
      }

      commitSaved();
      setToast({ message: '保存しました', type: 'success' });
    } catch (err) {
      console.error('[InteractionRulesTab] save failed', err);
      const message =
        err instanceof PaneOverrideSaveError
          ? err.message
          : '保存に失敗しました';
      setToast({ message, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPosition = async () => {
    if (!saveContext || !editPane || !isAdditionalPane(editPane)) return;
    setIsSaving(true);
    try {
      await resetPanePositionModeOverride(saveContext);
      const next = toDraft(settings, { ...editPane, settings: null });
      commitSaved(next);
      setToast({ message: 'Space 設定に戻しました', type: 'success' });
    } catch (err) {
      console.error('[InteractionRulesTab] reset failed', err);
      setToast({ message: 'リセットに失敗しました', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <SettingsPageHeader
        title="投稿・交流ルール"
        description="投稿フォーム以外の、参加者の行動ルールを設定します。"
      >
        <SettingsSection>
          <div className={formStyles.toggleList}>
            <label className={formStyles.toggleItem}>
              <span className={formStyles.toggleLabel}>いいね</span>
              <input
                type="checkbox"
                className={formStyles.toggle}
                checked={draft.likesEnabled}
                onChange={() => setDraft({ ...draft, likesEnabled: !draft.likesEnabled })}
              />
              <span className={formStyles.toggleSlider} />
            </label>
          </div>

          <h3 className={formStyles.sectionTitle} style={{ marginTop: '2rem' }}>投稿の編集権限</h3>
          <p className={formStyles.description}>スペース上で吹き出しを移動・リサイズ・色変更できるユーザーを設定します</p>
          <div className={formStyles.radioList}>
            <label className={formStyles.radioItem}>
              <input
                type="radio"
                name="bubbleEditPermission"
                checked={draft.bubbleEditPermission === 'all'}
                onChange={() => setDraft({ ...draft, bubbleEditPermission: 'all' })}
              />
              <span className={formStyles.radioLabel}>全員が編集可能</span>
            </label>
            <label className={formStyles.radioItem}>
              <input
                type="radio"
                name="bubbleEditPermission"
                checked={draft.bubbleEditPermission === 'owner_and_admin'}
                onChange={() => setDraft({ ...draft, bubbleEditPermission: 'owner_and_admin' })}
              />
              <span className={formStyles.radioLabel}>投稿者本人と管理者のみ</span>
            </label>
          </div>

          <h3 className={formStyles.sectionTitle} style={{ marginTop: '2rem' }}>投稿位置</h3>
          <p className={formStyles.description}>投稿時にスペース内のエリアを指定できるかを設定します（タブごとに上書き可能）</p>
          {editPane && isAdditionalPane(editPane) && (
            <PaneOverrideHint hasOverride={hasPositionOverride} onReset={handleResetPosition} />
          )}
          <div className={formStyles.radioList}>
            <label className={formStyles.radioItem}>
              <input
                type="radio"
                name="positionMode"
                checked={draft.positionMode === 'auto'}
                onChange={() => setDraft({ ...draft, positionMode: 'auto' })}
              />
              <span className={formStyles.radioLabel}>自動で配置する</span>
            </label>
            <label className={formStyles.radioItem}>
              <input
                type="radio"
                name="positionMode"
                checked={draft.positionMode === 'selector'}
                onChange={() => setDraft({ ...draft, positionMode: 'selector' })}
              />
              <span className={formStyles.radioLabel}>投稿者がおおよその位置を選ぶ</span>
            </label>
          </div>

          <h3 className={formStyles.sectionTitle} style={{ marginTop: '2rem' }}>過去の投稿との出会い</h3>
          <p className={formStyles.description}>7日以上前の投稿を、振り返り画面にランダムで表示します</p>
          <div className={formStyles.toggleList}>
            <label className={formStyles.toggleItem}>
              <span className={formStyles.toggleLabel}>ランダム想起を有効にする</span>
              <input
                type="checkbox"
                className={formStyles.toggle}
                checked={draft.randomRecallEnabled}
                onChange={() => setDraft({ ...draft, randomRecallEnabled: !draft.randomRecallEnabled })}
              />
              <span className={formStyles.toggleSlider} />
            </label>
          </div>
        </SettingsSection>

        <SettingsSaveBar
          isDirty={isDirty}
          isSaving={isSaving}
          onDiscard={discard}
          onSave={handleSave}
        />
      </SettingsPageHeader>

      {toast && (
        <div className={`${sharedStyles.toast} ${toast.type === 'success' ? sharedStyles.toastSuccess : sharedStyles.toastError}`}>
          {toast.message}
        </div>
      )}
    </>
  );
};
