import { useEffect, useRef, useState } from 'react';
import type { Space } from '../../core/types/space';
import { updateSpaceInDb } from '../../core/utils/spacesApi';
import { useScreenDraft } from '../../core/hooks/useScreenDraft';
import { BackgroundSelector } from '../BackgroundSelector/BackgroundSelector';
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

export const BackgroundTab = ({ space, onUpdateSpace, onDirtyChange }: Props) => {
  const initial: BackgroundDraft = {
    background: space.background,
    savedBackgroundImages: space.savedBackgroundImages,
  };
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

  const handleSelect = (background: Space['background']) => {
    if (background?.kind === 'image' && background.source === 'temp') {
      objectURLsRef.current.add(background.value);
    }
    setDraft({ ...draft, background });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const patch: Partial<Space> = {
        background: draft.background,
        savedBackgroundImages: draft.savedBackgroundImages,
      };
      onUpdateSpace(patch);
      await updateSpaceInDb(space.id, patch);
      commitSaved();
      setToast({ message: '保存しました', type: 'success' });
    } catch (err) {
      console.error('[BackgroundTab] save failed', err);
      setToast({ message: '保存に失敗しました', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <SettingsPageHeader title="背景" description="スペースの背景デザインを選択してください。">
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
