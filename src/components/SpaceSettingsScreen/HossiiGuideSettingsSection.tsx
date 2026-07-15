import { useMemo, useState } from 'react';
import type { HossiiGuideSettings } from '../../core/types/settings';
import { listHossiiGuidePackages } from '../../core/assets/hossiiGuidePackages';
import {
  formatGuideMessageText,
  hasInvalidStoredPackageKey,
  resolveGuideDisplayMessage,
} from '../../core/utils/hossiiGuide';
import { SettingsSection } from './SettingsSection';
import formStyles from './GeneralTab.module.css';
import styles from './HossiiGuideSettingsSection.module.css';

type Props = {
  draft: HossiiGuideSettings;
  onChange: (next: HossiiGuideSettings) => void;
  validationError?: string | null;
};

export const HossiiGuideSettingsSection = ({ draft, onChange, validationError }: Props) => {
  const packages = listHossiiGuidePackages();
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);

  const selectedPackage = useMemo(
    () => packages.find((p) => p.key === draft.packageKey),
    [packages, draft.packageKey],
  );

  const invalidStoredKey = hasInvalidStoredPackageKey(draft);

  const handleResamplePreview = () => {
    setPreviewMessage(resolveGuideDisplayMessage(draft));
  };

  const displayPreview =
    previewMessage ??
    (selectedPackage?.messages[0]
      ? formatGuideMessageText(selectedPackage.messages[0])
      : null);

  return (
    <SettingsSection
      title="Hossiiのひとこと"
      description="スペース利用中、Hossiiが案内や問いかけの吹き出しで声をかけます。入室セリフ（基本情報）とは別の機能です。"
    >
      <div className={formStyles.toggleList}>
        <label className={formStyles.toggleItem}>
          <span className={formStyles.toggleLabel}>機能を有効にする</span>
          <input
            type="checkbox"
            className={formStyles.toggle}
            checked={draft.enabled}
            onChange={() => onChange({ ...draft, enabled: !draft.enabled, mode: 'package' })}
          />
          <span className={formStyles.toggleSlider} />
        </label>
      </div>

      {draft.enabled && (
        <div className={styles.enabledBody}>
          <fieldset className={styles.modeFieldset}>
            <legend className={styles.legend}>話し方</legend>
            <label className={styles.modeOption}>
              <input type="radio" name="hossiiGuideMode" checked readOnly />
              <span>用意された言葉から選ぶ</span>
            </label>
            <label className={`${styles.modeOption} ${styles.modeDisabled}`}>
              <input type="radio" name="hossiiGuideModeDisabled1" disabled />
              <span>自分の言葉を使う</span>
              <span className={styles.phaseTag}>Phase 2</span>
            </label>
            <label className={`${styles.modeOption} ${styles.modeDisabled}`}>
              <input type="radio" name="hossiiGuideModeDisabled2" disabled />
              <span>両方を混ぜる</span>
              <span className={styles.phaseTag}>Phase 3</span>
            </label>
          </fieldset>

          <label className={styles.selectLabel} htmlFor="hossii-guide-package">
            言葉のセット
          </label>
          <select
            id="hossii-guide-package"
            className={formStyles.nameInput}
            value={draft.packageKey ?? ''}
            onChange={(e) =>
              onChange({
                ...draft,
                packageKey: e.target.value || undefined,
                mode: 'package',
              })
            }
          >
            <option value="">選択してください</option>
            {packages.map((pkg) => (
              <option key={pkg.key} value={pkg.key}>
                {pkg.label}
              </option>
            ))}
          </select>

          {invalidStoredKey && (
            <p className={styles.warningText} role="alert">
              言葉のセットを選び直してください
            </p>
          )}

          {selectedPackage && (
            <div className={styles.messageListBlock}>
              <p className={styles.messageListTitle}>このセットには、こんな言葉が入っています</p>
              <ul className={styles.messageList}>
                {selectedPackage.messages.map((msg) => (
                  <li key={msg}>「{formatGuideMessageText(msg)}」</li>
                ))}
              </ul>
              <button
                type="button"
                className={styles.resampleButton}
                onClick={handleResamplePreview}
              >
                別の言葉を試す
              </button>
            </div>
          )}

          {validationError && (
            <p className={styles.errorText} role="alert">
              {validationError}
            </p>
          )}

          {displayPreview && (
            <div className={styles.previewBlock} aria-label="プレビュー（参考表示）">
              <p className={styles.previewNote}>
                プレビュー（参考表示）。利用者画面のタイミング・位置とは一致しません。
              </p>
              <div className={styles.previewStage}>
                <div className={styles.previewHossii} aria-hidden>
                  🌟
                </div>
                <div className={styles.previewBubble} role="status">
                  {displayPreview}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </SettingsSection>
  );
};
