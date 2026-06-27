import { useEffect, useMemo, useRef, useState } from 'react';
import type { Space } from '../../core/types/space';
import type { SpacePane } from '../../core/types/spacePane';
import { useScreenDraft } from '../../core/hooks/useScreenDraft';
import { resolvePaneBackground } from '../../core/utils/resolvePaneBackground';
import { resolvePaneSavedBackgroundImages } from '../../core/utils/resolvePaneSavedBackgroundImages';
import {
  hasPaneColumnOverride,
  isAdditionalPane,
} from '../../core/utils/paneOverrideFields';
import {
  PaneOverrideSaveError,
  resetPaneBackgroundOverride,
  savePaneBackgroundOverride,
} from '../../core/utils/savePaneSettingOverride';
import { BackgroundSelector } from '../BackgroundSelector/BackgroundSelector';
import { useSettingsEditPane } from './SettingsEditPaneContext';
import { PaneOverrideHint } from './PaneOverrideHint';
import { SettingsPageHeader } from './SettingsPageHeader';
import { SettingsSection } from './SettingsSection';
import { SettingsSaveBar } from './SettingsSaveBar';
import sharedStyles from './SettingsShared.module.css';

type BackgroundDraft = {
  background?: Space['background'];
  savedBackgroundImages?: string[];
};

type Props = {
  space: Space;
  onUpdateSpace: (patch: Partial<Space>) => void;
  onDirtyChange: (dirty: boolean) => void;
};

function buildInitialDraft(space: Space, editPane: SpacePane | null): BackgroundDraft {
  return {
    background: resolvePaneBackground(editPane, space),
    savedBackgroundImages: resolvePaneSavedBackgroundImages(editPane, space),
  };
}

export const BackgroundTab = ({ space, onUpdateSpace, onDirtyChange }: Props) => {
  const { editPane, saveContext } = useSettingsEditPane();
  const initial = useMemo(() => buildInitialDraft(space, editPane), [space, editPane]);
  const { draft, setDraft, isDirty, discard, commitSaved } = useScreenDraft(initial);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const objectURLsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const urls = objectURLsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const hasOverride =
    editPane != null &&
    isAdditionalPane(editPane) &&
    (hasPaneColumnOverride(editPane, 'background') ||
      hasPaneColumnOverride(editPane, 'savedBackgroundImages'));

  const handleSelect = (background: Space['background']) => {
    if (background?.kind === 'image' && background.source === 'temp') {
      objectURLsRef.current.add(background.value);
    }
    setDraft({ ...draft, background });
  };

  const handleSave = async () => {
    if (!saveContext) return;
    setIsSaving(true);
    try {
      await savePaneBackgroundOverride(saveContext, {
        background: draft.background,
        savedBackgroundImages: draft.savedBackgroundImages,
      });
      if (saveContext.editPane.isDefault) {
        onUpdateSpace({
          background: draft.background,
          savedBackgroundImages: draft.savedBackgroundImages,
        });
      }
      commitSaved();
      setToast({ message: '保存しました', type: 'success' });
    } catch (err) {
      console.error('[BackgroundTab] save failed', err);
      const message =
        err instanceof PaneOverrideSaveError
          ? err.message
          : '保存に失敗しました';
      setToast({ message, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!saveContext || !editPane || !isAdditionalPane(editPane)) return;
    setIsSaving(true);
    try {
      await resetPaneBackgroundOverride(saveContext);
      const next = buildInitialDraft(space, { ...editPane, background: null, savedBackgroundImages: null });
      commitSaved(next);
      setToast({ message: 'Space 設定に戻しました', type: 'success' });
    } catch (err) {
      console.error('[BackgroundTab] reset failed', err);
      setToast({ message: 'リセットに失敗しました', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <SettingsPageHeader title="背景" description="スペースの背景デザインを選択してください。">
        {editPane && isAdditionalPane(editPane) && (
          <PaneOverrideHint hasOverride={hasOverride} onReset={handleReset} />
        )}
        <SettingsSection>
          <BackgroundSelector
            currentBackground={draft.background}
            onSelect={handleSelect}
            onImageURLRevoke={(url) => {
              URL.revokeObjectURL(url);
              objectURLsRef.current.delete(url);
            }}
            spaceId={space.id}
            savedBackgroundImages={draft.savedBackgroundImages}
            onUpdateSavedImages={(urls) => setDraft({ ...draft, savedBackgroundImages: urls })}
          />
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
