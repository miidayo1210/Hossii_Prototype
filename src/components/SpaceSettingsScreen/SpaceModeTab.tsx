import { useEffect, useMemo, useState } from 'react';
import type { Space } from '../../core/types/space';
import type { SpaceModeId, SpaceSettings } from '../../core/types/settings';
import { DEFAULT_SPACE_MODE_STATE } from '../../core/types/settings';
import { saveSpaceSettings } from '../../core/utils/settingsStorage';
import { upsertSpaceSettings } from '../../core/utils/spaceSettingsApi';
import { updateSpaceInDb } from '../../core/utils/spacesApi';
import {
  applySpaceMode,
  buildModeDiff,
  buildModeTarget,
} from '../../core/utils/spaceModeApply';
import { refreshModeCustomization } from '../../core/utils/spaceModeCustomize';
import {
  getSpaceModeLabel,
  SPACE_MODE_PRESETS,
} from '../../core/utils/spaceModePresets';
import { SettingsPageHeader } from './SettingsPageHeader';
import { SettingsSection } from './SettingsSection';
import { SpaceModePreviewModal } from './SpaceModePreviewModal';
import sharedStyles from './SettingsShared.module.css';

type Props = {
  space: Space;
  settings: SpaceSettings;
  onUpdateSpace: (patch: Partial<Space>) => void;
  onUpdateSettings: (settings: SpaceSettings) => void;
};

export const SpaceModeTab = ({ space, settings, onUpdateSpace, onUpdateSettings }: Props) => {
  const [previewModeId, setPreviewModeId] = useState<SpaceModeId | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const mode = settings.mode ?? DEFAULT_SPACE_MODE_STATE;

  useEffect(() => {
    const refreshed = refreshModeCustomization(space, settings);
    if (!refreshed) return;
    const next = { ...settings, mode: refreshed };
    onUpdateSettings(next);
    saveSpaceSettings(next);
    upsertSpaceSettings(next).catch((err) => {
      console.error('[SpaceModeTab] mode customization sync failed', err);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const previewTarget = useMemo(() => {
    if (!previewModeId) return null;
    return buildModeTarget(previewModeId, space, settings);
  }, [previewModeId, space, settings]);

  const previewDiff = useMemo(() => {
    if (!previewTarget) return [];
    return buildModeDiff(space, settings, previewTarget.space, previewTarget.settings);
  }, [previewTarget, space, settings]);

  const handlePreviewClick = (modeId: SpaceModeId) => {
    if (
      mode.isCustomized &&
      !window.confirm(
        'カスタマイズした設定が上書きされます。\nこのモードを適用しますか？',
      )
    ) {
      return;
    }
    setPreviewModeId(modeId);
  };

  const handleApply = async () => {
    if (!previewModeId) return;
    setIsApplying(true);
    try {
      const { nextSpace, nextSettings } = applySpaceMode(previewModeId, space, settings);
      const spacePatch: Partial<Space> = {};
      if (nextSpace.isPrivate !== space.isPrivate) {
        spacePatch.isPrivate = nextSpace.isPrivate;
      }
      if (Object.keys(spacePatch).length > 0) {
        onUpdateSpace(spacePatch);
        await updateSpaceInDb(space.id, spacePatch);
      }
      onUpdateSettings(nextSettings);
      saveSpaceSettings(nextSettings);
      await upsertSpaceSettings(nextSettings);
      setToast({
        message: `${getSpaceModeLabel(previewModeId)} の設定を適用しました`,
        type: 'success',
      });
      setPreviewModeId(null);
    } catch (err) {
      console.error('[SpaceModeTab] apply failed', err);
      setToast({ message: '適用に失敗しました', type: 'error' });
    } finally {
      setIsApplying(false);
    }
  };

  const showCustomizePill =
    mode.appliedMode !== 'custom' && mode.isCustomized;

  return (
    <>
      <SettingsPageHeader
        title="スペースモード"
        description="利用目的に応じた設定の一括プリセットです。適用後も各画面で個別に変更できます。"
      >
        {showCustomizePill && (
          <div className={sharedStyles.customizePill}>
            {getSpaceModeLabel(mode.appliedMode)} をもとにカスタマイズされています
          </div>
        )}

        <SettingsSection title="プリセットを選ぶ">
          <div className={sharedStyles.modeCardGrid}>
            {SPACE_MODE_PRESETS.map((preset) => {
              const isActive = mode.appliedMode === preset.id && !mode.isCustomized;
              return (
                <div key={preset.id} className={sharedStyles.modeCard}>
                  <div className={sharedStyles.modeCardHeader}>
                    <h3 className={sharedStyles.modeCardTitle}>{preset.label}</h3>
                    {isActive && <span className={sharedStyles.modeCardBadge}>適用中</span>}
                  </div>
                  <p className={sharedStyles.modeCardDescription}>{preset.description}</p>
                  <button
                    type="button"
                    className={sharedStyles.modePreviewLink}
                    onClick={() => handlePreviewClick(preset.id)}
                  >
                    プレビュー
                  </button>
                </div>
              );
            })}
          </div>
        </SettingsSection>
      </SettingsPageHeader>

      {previewModeId && (
        <SpaceModePreviewModal
          modeLabel={getSpaceModeLabel(previewModeId)}
          diffLines={previewDiff}
          isApplying={isApplying}
          onClose={() => !isApplying && setPreviewModeId(null)}
          onApply={handleApply}
        />
      )}

      {toast && (
        <div
          className={`${sharedStyles.toast} ${toast.type === 'success' ? sharedStyles.toastSuccess : sharedStyles.toastError}`}
        >
          {toast.message}
        </div>
      )}
    </>
  );
};
