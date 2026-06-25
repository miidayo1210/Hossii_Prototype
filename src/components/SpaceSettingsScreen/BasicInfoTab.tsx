import { useEffect, useState } from 'react';
import type { Space } from '../../core/types/space';
import type { SpaceSettings } from '../../core/types/settings';
import { saveSpaceSettings } from '../../core/utils/settingsStorage';
import { updateSpaceInDb } from '../../core/utils/spacesApi';
import { useScreenDraft } from '../../core/hooks/useScreenDraft';
import { SettingsPageHeader } from './SettingsPageHeader';
import { SettingsSection } from './SettingsSection';
import { SettingsSaveBar } from './SettingsSaveBar';
import sharedStyles from './SettingsShared.module.css';
import formStyles from './GeneralTab.module.css';

type BasicInfoDraft = {
  name: string;
  description: string;
  welcomeMessage: string;
};

type Props = {
  space: Space;
  settings: SpaceSettings;
  onUpdateSpace: (patch: Partial<Space>) => void;
  onUpdateSettings: (settings: SpaceSettings) => void;
  onDirtyChange: (dirty: boolean) => void;
};

export const BasicInfoTab = ({
  space,
  settings,
  onUpdateSpace,
  onUpdateSettings,
  onDirtyChange,
}: Props) => {
  const initial: BasicInfoDraft = {
    name: space.name,
    description: space.description ?? '',
    welcomeMessage: space.welcomeMessage ?? '',
  };
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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      onUpdateSpace({
        name: draft.name,
        description: draft.description || undefined,
        welcomeMessage: draft.welcomeMessage || undefined,
      });
      onUpdateSettings({ ...settings, spaceName: draft.name });
      saveSpaceSettings({ ...settings, spaceName: draft.name });
      await updateSpaceInDb(space.id, {
        name: draft.name,
        description: draft.description || undefined,
        welcomeMessage: draft.welcomeMessage || undefined,
      });
      commitSaved();
      setToast({ message: '保存しました', type: 'success' });
    } catch (err) {
      console.error('[BasicInfoTab] save failed', err);
      setToast({ message: '保存に失敗しました', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <SettingsPageHeader
        title="基本情報"
        description="スペースそのものを説明するテキスト情報を設定します。"
      >
        <SettingsSection title="スペース情報">
          <label className={formStyles.toggleLabel} htmlFor="space-name">
            スペース名
          </label>
          <p className={formStyles.description}>参加者に表示されるスペースの名称です</p>
          <input
            id="space-name"
            type="text"
            className={formStyles.nameInput}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="スペースの名前を入力"
            maxLength={50}
          />

          <label className={formStyles.toggleLabel} htmlFor="space-description" style={{ marginTop: '1.5rem', display: 'block' }}>
            スペース説明
          </label>
          <p className={formStyles.description}>スペース画面に表示する、このスペースの目的や使い方の一言説明です</p>
          <input
            id="space-description"
            type="text"
            className={formStyles.nameInput}
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="例: チームの日々の気持ちを共有するスペースです。"
            maxLength={50}
          />
          <p className={formStyles.charCount}>{draft.description.length} / 50</p>

          <label className={formStyles.toggleLabel} htmlFor="welcome-message" style={{ marginTop: '1.5rem', display: 'block' }}>
            ウェルカムメッセージ
          </label>
          <p className={formStyles.description}>初めて入室する人に Hossii が話しかけるメッセージです。未設定時はデフォルト文言を使用します</p>
          <textarea
            id="welcome-message"
            className={formStyles.textarea}
            value={draft.welcomeMessage}
            onChange={(e) => setDraft({ ...draft, welcomeMessage: e.target.value })}
            placeholder={`「${draft.name || 'スペース'}」にようこそ！ニックネームを入力してね。`}
            maxLength={100}
            rows={3}
          />
          <p className={formStyles.charCount}>{draft.welcomeMessage.length} / 100</p>
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
