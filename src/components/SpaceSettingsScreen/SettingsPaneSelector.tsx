import { useSpacePane } from '../../core/hooks/SpacePaneProvider';
import { useSettingsEditPane } from './SettingsEditPaneContext';
import styles from './SettingsPaneSelector.module.css';

export function SettingsPaneSelector() {
  const { visiblePanes } = useSpacePane();
  const { editPane, isAdditionalEditPane, requestEditPaneChange } = useSettingsEditPane();

  if (visiblePanes.length <= 1 || !editPane) return null;

  return (
    <div className={styles.wrapper}>
      <label className={styles.label} htmlFor="settings-edit-pane">
        編集対象タブ
      </label>
      <div className={styles.row}>
        <select
          id="settings-edit-pane"
          className={styles.select}
          value={editPane.id}
          onChange={(e) => {
            requestEditPaneChange(e.target.value);
          }}
        >
          {visiblePanes.map((pane) => (
            <option key={pane.id} value={pane.id}>
              {pane.name}
              {pane.isDefault ? '（デフォルト）' : ''}
            </option>
          ))}
        </select>
        {isAdditionalEditPane && (
          <span className={styles.overrideBadge}>Space 設定を上書き中</span>
        )}
      </div>
    </div>
  );
}
