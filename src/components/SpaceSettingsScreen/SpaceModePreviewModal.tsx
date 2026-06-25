import type { ModeDiffLine } from '../../core/utils/spaceModeApply';
import sharedStyles from './SettingsShared.module.css';

type Props = {
  modeLabel: string;
  diffLines: ModeDiffLine[];
  isApplying: boolean;
  onClose: () => void;
  onApply: () => void;
};

export const SpaceModePreviewModal = ({
  modeLabel,
  diffLines,
  isApplying,
  onClose,
  onApply,
}: Props) => {
  const hasChanges = diffLines.length > 0;

  return (
    <div
      className={sharedStyles.modalOverlay}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isApplying) onClose();
      }}
    >
      <div className={sharedStyles.modal} role="dialog" aria-modal="true" aria-labelledby="mode-preview-title">
        <div className={sharedStyles.modalHeader}>
          <h2 id="mode-preview-title" className={sharedStyles.modalTitle}>
            {modeLabel} の設定変更
          </h2>
          <button
            type="button"
            className={sharedStyles.modalCloseButton}
            onClick={onClose}
            disabled={isApplying}
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        <div className={sharedStyles.modalBody}>
          {hasChanges ? (
            <>
              <p className={sharedStyles.modalDescription}>
                以下の設定が変更されます。適用後も各画面で個別に変更できます。
              </p>
              <ul className={sharedStyles.diffList}>
                {diffLines.map((line) => (
                  <li key={line.label} className={sharedStyles.diffItem}>
                    <span className={sharedStyles.diffLabel}>{line.label}</span>
                    <span className={sharedStyles.diffChange}>
                      {line.before} → {line.after}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className={sharedStyles.modalDescription}>変更はありません。</p>
          )}
        </div>

        <div className={sharedStyles.modalFooter}>
          <button
            type="button"
            className={sharedStyles.ghostButton}
            onClick={onClose}
            disabled={isApplying}
          >
            キャンセル
          </button>
          <button
            type="button"
            className={sharedStyles.primaryButton}
            onClick={onApply}
            disabled={!hasChanges || isApplying}
          >
            {isApplying ? '適用中…' : 'この設定を適用'}
          </button>
        </div>
      </div>
    </div>
  );
};
