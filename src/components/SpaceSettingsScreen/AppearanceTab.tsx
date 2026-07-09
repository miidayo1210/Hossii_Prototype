import { useEffect, useMemo, useState } from 'react';
import type { SpaceSettings, StarMarkerType } from '../../core/types/settings';
import { STAR_MARKER_OPTIONS, DEFAULT_STAR_MARKER } from '../../core/types/settings';
import type { Space } from '../../core/types/space';
import { BUBBLE_SHAPE_PRESETS } from '../../core/assets/bubbleShapes';
import { saveSpaceSettings } from '../../core/utils/settingsStorage';
import { updateTimelineDepthEnabled, upsertSpaceSettings } from '../../core/utils/spaceSettingsApi';
import {
  hasPaneBubbleShapeOverride,
  resolvePaneBubbleShapePng,
} from '../../core/utils/resolvePaneBubbleShapePng';
import {
  bubbleShapePngPatchValue,
  buildBubbleShapePngPatch,
  isAdditionalPane,
} from '../../core/utils/paneOverrideFields';
import {
  PaneOverrideSaveError,
  resetPaneBubbleShapeOverride,
  savePaneBubbleShapeOverride,
} from '../../core/utils/savePaneSettingOverride';
import { useScreenDraft } from '../../core/hooks/useScreenDraft';
import { useSettingsEditPane } from './SettingsEditPaneContext';
import { PaneOverrideHint } from './PaneOverrideHint';
import { SettingsPageHeader } from './SettingsPageHeader';
import { SettingsSection } from './SettingsSection';
import { SettingsSaveBar } from './SettingsSaveBar';
import {
  mergeTimelineDepthIntoSettings,
  readTimelineDepthDraft,
  shouldPersistTimelineDepth,
} from './appearanceTimelineDepthSave';
import sharedStyles from './SettingsShared.module.css';
import formStyles from './GeneralTab.module.css';
import styles from './AppearanceTab.module.css';

type AppearanceDraft = {
  starMarkerType: StarMarkerType;
  bubbleShapePng: string | null;
  timelineDepthEnabled: boolean;
};

type Props = {
  space: Space;
  settings: SpaceSettings;
  canManageTimelineDepth: boolean;
  settingsDbSynced: boolean;
  onUpdate: (settings: SpaceSettings) => void;
  onUpdateSpace: (patch: Partial<Space>) => void;
  onDirtyChange: (dirty: boolean) => void;
};

export const AppearanceTab = ({
  space,
  settings,
  canManageTimelineDepth,
  settingsDbSynced,
  onUpdate,
  onDirtyChange,
}: Props) => {
  const { editPane, saveContext } = useSettingsEditPane();
  const initial: AppearanceDraft = useMemo(
    () => ({
      starMarkerType: settings.starMarkerType ?? DEFAULT_STAR_MARKER,
      bubbleShapePng: resolvePaneBubbleShapePng(editPane, space) ?? null,
      timelineDepthEnabled: settingsDbSynced
        ? readTimelineDepthDraft(settings)
        : false,
    }),
    [settings, editPane, space, settingsDbSynced],
  );
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

  const hasBubbleOverride =
    editPane != null && isAdditionalPane(editPane) && hasPaneBubbleShapeOverride(editPane);

  const handleSave = async () => {
    if (!saveContext) return;
    const timelineChanged = shouldPersistTimelineDepth(
      draft.timelineDepthEnabled,
      settings,
      canManageTimelineDepth,
    );
    if (timelineChanged && !canManageTimelineDepth) {
      setToast({ message: '管理者のみ変更できます', type: 'error' });
      return;
    }

    setIsSaving(true);
    const starMarkerChanged = draft.starMarkerType !== (settings.starMarkerType ?? DEFAULT_STAR_MARKER);
    const bubbleChanged = initial.bubbleShapePng !== draft.bubbleShapePng;
    const bubblePatch = buildBubbleShapePngPatch(initial.bubbleShapePng, draft.bubbleShapePng);

    try {
      if (starMarkerChanged) {
        await upsertSpaceSettings({ ...settings, starMarkerType: draft.starMarkerType });
      }
      if (bubbleChanged) {
        await savePaneBubbleShapeOverride(
          saveContext,
          bubbleShapePngPatchValue(bubblePatch),
        );
      }
      if (timelineChanged) {
        await updateTimelineDepthEnabled(space.id, draft.timelineDepthEnabled);
      }

      let nextSettings: SpaceSettings = {
        ...settings,
        starMarkerType: draft.starMarkerType,
      };
      if (timelineChanged) {
        nextSettings = mergeTimelineDepthIntoSettings(nextSettings, draft.timelineDepthEnabled);
      }
      onUpdate(nextSettings);
      saveSpaceSettings(nextSettings);
      commitSaved();
      setToast({ message: '保存しました', type: 'success' });
    } catch (err) {
      console.error('[AppearanceTab] save failed', err);
      const message =
        err instanceof PaneOverrideSaveError
          ? err.message
          : '保存に失敗しました';
      setToast({ message, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetBubble = async () => {
    if (!saveContext || !editPane || !isAdditionalPane(editPane)) return;
    setIsSaving(true);
    try {
      await resetPaneBubbleShapeOverride(saveContext);
      const next: AppearanceDraft = {
        ...draft,
        bubbleShapePng: resolvePaneBubbleShapePng({ ...editPane, bubbleShapePng: null }, space) ?? null,
      };
      commitSaved(next);
      setToast({ message: 'Space 設定に戻しました', type: 'success' });
    } catch (err) {
      console.error('[AppearanceTab] reset failed', err);
      setToast({ message: 'リセットに失敗しました', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <SettingsPageHeader
        title="投稿の見た目"
        description="スペース内の投稿表示に関するデフォルト設定です。"
      >
        <SettingsSection
          title="デフォルトの吹き出し形状"
          description="スペース全体のデフォルト形状です。投稿者による個別形状選択とは別設定です。"
        >
          {editPane && isAdditionalPane(editPane) && (
            <PaneOverrideHint hasOverride={hasBubbleOverride} onReset={handleResetBubble} />
          )}
          <div className={styles.shapeList}>
            <button
              type="button"
              className={`${styles.shapeOption} ${draft.bubbleShapePng === null ? styles.shapeOptionActive : ''}`}
              onClick={() => setDraft({ ...draft, bubbleShapePng: null })}
            >
              <span className={styles.shapePreviewDefault} aria-hidden="true" />
              <span className={styles.shapeLabel}>デフォルト（角丸）</span>
            </button>
            {BUBBLE_SHAPE_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                className={`${styles.shapeOption} ${draft.bubbleShapePng === preset.path ? styles.shapeOptionActive : ''}`}
                onClick={() => setDraft({ ...draft, bubbleShapePng: preset.path })}
              >
                <img
                  src={preset.path}
                  alt=""
                  className={styles.shapePreviewImg}
                  aria-hidden="true"
                />
                <span className={styles.shapeLabel}>{preset.label}</span>
              </button>
            ))}
          </div>
        </SettingsSection>

        <SettingsSection
          title="星モードのマーカー形状"
          description="星表示モードで投稿位置を示すマーカーの形を選択します（Space 共通）。"
        >
          <div className={styles.shapeList}>
            {STAR_MARKER_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`${styles.shapeOption} ${draft.starMarkerType === option.id ? styles.shapeOptionActive : ''}`}
                onClick={() => setDraft({ ...draft, starMarkerType: option.id })}
              >
                <span
                  className={`${styles.markerPreview} ${styles[`markerPreview_${option.id}`]}`}
                  aria-hidden="true"
                />
                <span className={styles.shapeLabel}>{option.label}</span>
              </button>
            ))}
          </div>
        </SettingsSection>

        {canManageTimelineDepth && settingsDbSynced && (
          <SettingsSection
            title="時系列による奥行き表示"
            description="新しい投稿を手前に、古い投稿を少し小さく表示し、スペースに時間の奥行きをつくります。現在は星モードにのみ適用されます。"
          >
            <div className={styles.timelineDepthToggle}>
              <span className={styles.toggleStateLabel} aria-hidden="true">OFF</span>
              <label className={formStyles.toggleWrapper}>
                <input
                  type="checkbox"
                  className={formStyles.toggleInput}
                  checked={draft.timelineDepthEnabled}
                  onChange={() =>
                    setDraft({ ...draft, timelineDepthEnabled: !draft.timelineDepthEnabled })
                  }
                  aria-label={`時系列による奥行き表示を${draft.timelineDepthEnabled ? 'OFF' : 'ON'}にする`}
                />
                <span className={formStyles.toggleSlider} />
              </label>
              <span className={styles.toggleStateLabel} aria-hidden="true">ON</span>
            </div>
          </SettingsSection>
        )}

        <SettingsSaveBar isDirty={isDirty} isSaving={isSaving} onDiscard={discard} onSave={handleSave} />
      </SettingsPageHeader>

      {toast && (
        <div className={`${sharedStyles.toast} ${toast.type === 'success' ? sharedStyles.toastSuccess : sharedStyles.toastError}`}>
          {toast.message}
        </div>
      )}
    </>
  );
};
