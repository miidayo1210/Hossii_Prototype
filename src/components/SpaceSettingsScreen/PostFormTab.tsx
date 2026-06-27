import { useEffect, useMemo, useState } from 'react';
import type { SpaceSettings } from '../../core/types/settings';
import {
  allPostFieldsDisabled,
  applyPostFieldChange,
  mergePostFieldSettings,
  type PostFieldKey,
} from '../../core/utils/postFieldSettings';
import { resolvePanePostFields } from '../../core/utils/resolvePanePostFields';
import { hasPanePostFieldsOverride, isAdditionalPane } from '../../core/utils/paneOverrideFields';
import {
  PaneOverrideSaveError,
  resetPanePostFieldsOverride,
  savePanePostFieldsOverride,
} from '../../core/utils/savePaneSettingOverride';
import { useScreenDraft } from '../../core/hooks/useScreenDraft';
import { useSettingsEditPane } from './SettingsEditPaneContext';
import { PaneOverrideHint } from './PaneOverrideHint';
import { SettingsPageHeader } from './SettingsPageHeader';
import { SettingsSaveBar } from './SettingsSaveBar';
import sharedStyles from './SettingsShared.module.css';
import styles from './PostFormTab.module.css';

type Props = {
  settings: SpaceSettings;
  onUpdate: (settings: SpaceSettings) => void;
  onDirtyChange: (dirty: boolean) => void;
};

type FieldMeta = {
  key: PostFieldKey;
  icon: string;
  label: string;
  description: string;
};

const FIELD_LIST: FieldMeta[] = [
  { key: 'message', icon: '💬', label: 'メッセージ', description: '投稿本文のテキスト入力です' },
  { key: 'emotion', icon: '😊', label: '気持ち', description: 'Wow・刺さった など 8 種類の感情ボタンです' },
  { key: 'tags', icon: '🏷', label: 'タグ', description: 'プリセットタグの選択と自由タグ入力です' },
  { key: 'photo', icon: '📷', label: '写真', description: '画像ファイルのアップロードです' },
  { key: 'bubbleColor', icon: '🎨', label: '吹き出し色', description: '吹き出しの背景カラーパレットです' },
  { key: 'numberPost', icon: '🔢', label: '数値入力', description: '数値だけを投稿する専用フィールドです' },
];

export const PostFormTab = ({ settings, onUpdate, onDirtyChange }: Props) => {
  const { editPane, saveContext } = useSettingsEditPane();
  const resolvedInitial = useMemo(
    (): SpaceSettings => ({ ...settings, postFields: resolvePanePostFields(editPane, settings) }),
    [settings, editPane],
  );
  const { draft, setDraft, isDirty, discard, commitSaved } = useScreenDraft<SpaceSettings>(resolvedInitial);
  const pf = mergePostFieldSettings(draft.postFields);
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

  const hasOverride = editPane != null && isAdditionalPane(editPane) && hasPanePostFieldsOverride(editPane);

  const handleToggle = (field: PostFieldKey, key: 'enabled' | 'required', current: boolean) => {
    setDraft(applyPostFieldChange(draft, field, key, !current));
  };

  const handleSave = async () => {
    if (!saveContext) return;
    setIsSaving(true);
    try {
      const merged = mergePostFieldSettings(draft.postFields);
      await savePanePostFieldsOverride(saveContext, merged);
      if (saveContext.editPane.isDefault) {
        onUpdate({ ...draft, postFields: merged });
      }
      commitSaved();
      setToast({ message: '保存しました', type: 'success' });
    } catch (err) {
      console.error('[PostFormTab] save failed', err);
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
      await resetPanePostFieldsOverride(saveContext);
      const next = { ...settings, postFields: resolvePanePostFields({ ...editPane, settings: null }, settings) };
      commitSaved(next);
      setToast({ message: 'Space 設定に戻しました', type: 'success' });
    } catch (err) {
      console.error('[PostFormTab] reset failed', err);
      setToast({ message: 'リセットに失敗しました', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <SettingsPageHeader
        title="投稿フォーム"
        description="投稿パネルに表示する項目と、入力を必須にするかを管理します。"
      >
        {editPane && isAdditionalPane(editPane) && (
          <PaneOverrideHint hasOverride={hasOverride} onReset={handleReset} />
        )}
        <div className={styles.table}>
          <div className={styles.tableHeader}>
            <span>項目</span>
            <span style={{ textAlign: 'center' }}>表示</span>
            <span style={{ textAlign: 'center' }}>入力必須</span>
          </div>
          {FIELD_LIST.map((field) => {
            const config = pf[field.key];
            return (
              <div key={field.key} className={styles.row}>
                <div className={styles.fieldInfo}>
                  <div className={styles.fieldLabel}>
                    <span>{field.icon}</span>
                    <span>{field.label}</span>
                  </div>
                  <p className={styles.fieldDesc}>{field.description}</p>
                </div>
                <div className={styles.toggleCell}>
                  <label className={styles.toggleWrapper}>
                    <input
                      type="checkbox"
                      className={styles.toggleInput}
                      checked={config.enabled}
                      onChange={() => handleToggle(field.key, 'enabled', config.enabled)}
                      aria-label={`${field.label}の表示を${config.enabled ? 'OFF' : 'ON'}にする`}
                    />
                    <span className={styles.toggleSlider} />
                  </label>
                </div>
                <div className={`${styles.toggleCell} ${!config.enabled ? styles.toggleCellDisabled : ''}`}>
                  {config.enabled ? (
                    <label className={styles.toggleWrapper}>
                      <input
                        type="checkbox"
                        className={styles.toggleInput}
                        checked={config.required}
                        disabled={!config.enabled}
                        onChange={() => handleToggle(field.key, 'required', config.required)}
                        aria-label={`${field.label}の入力必須を${config.required ? 'OFF' : 'ON'}にする`}
                      />
                      <span className={styles.toggleSlider} />
                    </label>
                  ) : (
                    <span className={styles.requiredPlaceholder}>—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className={styles.footnote}>「入力必須」は「表示」が ON のときのみ設定できます。</p>

        {allPostFieldsDisabled(pf) && (
          <div className={styles.warning} role="alert">
            <p className={styles.warningTitle}>すべての項目が非表示になっています。</p>
            投稿パネルを開いても何も入力できなくなります。
          </div>
        )}

        <SettingsSaveBar isDirty={isDirty} isSaving={isSaving} onDiscard={discard} onSave={handleSave} />
      </SettingsPageHeader>

      {toast && (
        <div className={`${sharedStyles.toast} ${styles.toast} ${styles[toast.type]}`}>
          {toast.message}
        </div>
      )}
    </>
  );
};
