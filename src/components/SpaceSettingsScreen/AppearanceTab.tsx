import { useEffect, useMemo, useState } from 'react';
import type { SpaceSettings, StarMarkerType } from '../../core/types/settings';
import { STAR_MARKER_OPTIONS, DEFAULT_STAR_MARKER } from '../../core/types/settings';
import type { Space } from '../../core/types/space';
import { BUBBLE_SHAPE_PRESETS } from '../../core/assets/bubbleShapes';
import { saveSpaceSettings } from '../../core/utils/settingsStorage';
import { upsertSpaceSettings } from '../../core/utils/spaceSettingsApi';
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
import sharedStyles from './SettingsShared.module.css';
import styles from './AppearanceTab.module.css';

type AppearanceDraft = {
  starMarkerType: StarMarkerType;
  bubbleShapePng: string | null;
};

type Props = {
  space: Space;
  settings: SpaceSettings;
  onUpdate: (settings: SpaceSettings) => void;
  onUpdateSpace: (patch: Partial<Space>) => void;
  onDirtyChange: (dirty: boolean) => void;
};

export const AppearanceTab = ({
  space,
  settings,
  onUpdate,
  onDirtyChange,
}: Props) => {
  const { editPane, saveContext } = useSettingsEditPane();
  const initial: AppearanceDraft = useMemo(
    () => ({
      starMarkerType: settings.starMarkerType ?? DEFAULT_STAR_MARKER,
      bubbleShapePng: resolvePaneBubbleShapePng(editPane, space) ?? null,
    }),
    [settings.starMarkerType, editPane, space],
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
    setIsSaving(true);
    const updatedSettings = { ...settings, starMarkerType: draft.starMarkerType };
    try {
      onUpdate(updatedSettings);
      saveSpaceSettings(updatedSettings);
      await upsertSpaceSettings(updatedSettings);
      const bubblePatch = buildBubbleShapePngPatch(
        initial.bubbleShapePng,
        draft.bubbleShapePng,
      );
      await savePaneBubbleShapeOverride(
        saveContext,
        bubbleShapePngPatchValue(bubblePatch),
      );
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
