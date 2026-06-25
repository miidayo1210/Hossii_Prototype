import styles from './SettingsShared.module.css';

type Props = {
  isDirty: boolean;
  isSaving: boolean;
  onDiscard: () => void;
  onSave: () => void;
};

export const SettingsSaveBar = ({ isDirty, isSaving, onDiscard, onSave }: Props) => {
  if (!isDirty) return null;

  return (
    <div className={styles.saveBar} role="region" aria-label="未保存の変更">
      <span className={styles.saveBarHint}>変更があります</span>
      <div className={styles.saveBarActions}>
        <button type="button" className={styles.ghostButton} onClick={onDiscard} disabled={isSaving}>
          変更を破棄
        </button>
        <button type="button" className={styles.primaryButton} onClick={onSave} disabled={isSaving}>
          {isSaving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  );
};
