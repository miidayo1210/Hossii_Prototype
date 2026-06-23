import { useEffect, useState } from 'react';
import type { SpaceSettings } from '../../core/types/settings';
import { saveSpaceSettings } from '../../core/utils/settingsStorage';
import { upsertSpaceSettings, PostFieldsColumnMissingError } from '../../core/utils/spaceSettingsApi';
import {
  allPostFieldsDisabled,
  applyPostFieldChange,
  mergePostFieldSettings,
  type PostFieldKey,
} from '../../core/utils/postFieldSettings';
import { useFeatureFlags } from '../../core/hooks/useFeatureFlags';
import styles from './PostFormTab.module.css';

type Props = {
  settings: SpaceSettings;
  onUpdate: (settings: SpaceSettings) => void;
  spaceId: string;
};

type FieldMeta = {
  key: PostFieldKey;
  icon: string;
  label: string;
  description: string;
  showFlagBadge?: boolean;
};

const FIELD_LIST: FieldMeta[] = [
  { key: 'message', icon: '💬', label: 'メッセージ', description: '投稿本文のテキスト入力です' },
  { key: 'emotion', icon: '😊', label: '気持ち', description: 'Wow・刺さった など 8 種類の感情ボタンです' },
  { key: 'tags', icon: '🏷', label: 'タグ', description: 'プリセットタグの選択と自由タグ入力です' },
  { key: 'photo', icon: '📷', label: '写真', description: '画像ファイルのアップロードです' },
  { key: 'bubbleColor', icon: '🎨', label: '吹き出し色', description: '吹き出しの背景カラーパレットです' },
  {
    key: 'bubbleShape',
    icon: '🔷',
    label: '吹き出し形状',
    description: 'ハート・雲・風船など 14 種類の形状選択です',
    showFlagBadge: true,
  },
  { key: 'numberPost', icon: '🔢', label: '数値入力', description: '数値だけを投稿する専用フィールドです' },
];

type SavingKey = `${PostFieldKey}:${'enabled' | 'required'}` | null;

export const PostFormTab = ({ settings, onUpdate, spaceId }: Props) => {
  const { flags } = useFeatureFlags(spaceId);
  const pf = mergePostFieldSettings(settings.postFields);
  const [saving, setSaving] = useState<SavingKey>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleToggle = async (field: PostFieldKey, key: 'enabled' | 'required', current: boolean) => {
    const saveKey: SavingKey = `${field}:${key}`;
    if (saving) return;

    const next = !current;
    const updated = applyPostFieldChange(settings, field, key, next);
    const prev = settings;

    onUpdate(updated);
    saveSpaceSettings(updated);
    setSaving(saveKey);

    const meta = FIELD_LIST.find((f) => f.key === field);
    const label = meta?.label ?? field;
    const actionLabel = key === 'enabled' ? '表示' : '入力必須';

    try {
      await upsertSpaceSettings(updated);
      setToast({
        message: `「${label}」の${actionLabel}を ${next ? 'ON' : 'OFF'} にしました`,
        type: 'success',
      });
    } catch (err) {
      console.error('[PostFormTab] save failed', err);
      onUpdate(prev);
      saveSpaceSettings(prev);
      const message =
        err instanceof PostFieldsColumnMissingError
          ? 'Supabase に post_fields 列がありません。マイグレーション（20260623000000_add_post_fields_to_space_settings.sql）を適用してください。'
          : '設定の保存に失敗しました';
      setToast({ message, type: 'error' });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>投稿フォーム設定</h2>
      <p className={styles.description}>
        投稿パネルに表示する項目と、入力を必須にするかを管理します。
        変更はすぐにこのスペースの投稿パネルに反映されます。
      </p>

      <div className={styles.table}>
        <div className={styles.tableHeader}>
          <span>項目</span>
          <span style={{ textAlign: 'center' }}>表示</span>
          <span style={{ textAlign: 'center' }}>入力必須</span>
        </div>
        {FIELD_LIST.map((field) => {
          const config = pf[field.key];
          const enabledSaving = saving === `${field.key}:enabled`;
          const requiredSaving = saving === `${field.key}:required`;
          return (
            <div key={field.key} className={styles.row}>
              <div className={styles.fieldInfo}>
                <div className={styles.fieldLabel}>
                  <span>{field.icon}</span>
                  <span>{field.label}</span>
                  {field.showFlagBadge && !flags.bubble_shapes_extended && (
                    <span className={styles.flagBadge}>Feature Flag 要</span>
                  )}
                </div>
                <p className={styles.fieldDesc}>{field.description}</p>
              </div>
              <div className={styles.toggleCell}>
                <label className={styles.toggleWrapper}>
                  <input
                    type="checkbox"
                    className={styles.toggleInput}
                    checked={config.enabled}
                    disabled={enabledSaving}
                    onChange={() => handleToggle(field.key, 'enabled', config.enabled)}
                    aria-label={`${field.label}の表示を${config.enabled ? 'OFF' : 'ON'}にする`}
                  />
                  <span className={`${styles.toggleSlider} ${enabledSaving ? styles.saving : ''}`} />
                </label>
              </div>
              <div
                className={`${styles.toggleCell} ${!config.enabled ? styles.toggleCellDisabled : ''}`}
              >
                {config.enabled ? (
                  <label className={styles.toggleWrapper}>
                    <input
                      type="checkbox"
                      className={styles.toggleInput}
                      checked={config.required}
                      disabled={requiredSaving || !config.enabled}
                      onChange={() => handleToggle(field.key, 'required', config.required)}
                      aria-label={`${field.label}の入力必須を${config.required ? 'OFF' : 'ON'}にする`}
                    />
                    <span className={`${styles.toggleSlider} ${requiredSaving ? styles.saving : ''}`} />
                  </label>
                ) : (
                  <span className={styles.requiredPlaceholder}>—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className={styles.footnote}>
        「入力必須」は「表示」が ON のときのみ設定できます。
      </p>

      {allPostFieldsDisabled(pf) && (
        <div className={styles.warning} role="alert">
          <p className={styles.warningTitle}>すべての項目が非表示になっています。</p>
          投稿パネルを開いても何も入力できなくなります。
        </div>
      )}

      {toast && (
        <div className={`${styles.toast} ${styles[toast.type]}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
};
