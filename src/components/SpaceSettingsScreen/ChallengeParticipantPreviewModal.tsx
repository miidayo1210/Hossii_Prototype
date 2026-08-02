import type { ChallengeItem, ChallengeProgram } from '../../core/types/challengeProgram';
import { ChallengeScreen } from '../ChallengeScreen/ChallengeScreen';
import sharedStyles from './SettingsShared.module.css';
import styles from './ChallengeParticipantPreviewModal.module.css';

type Props = {
  program: ChallengeProgram;
  items: ChallengeItem[];
  onClose: () => void;
};

/**
 * Phone-framed participant Preview for challenge admin Step3.
 * Uses ChallengeScreen preview mode (no mutation / peer APIs).
 */
export function ChallengeParticipantPreviewModal({
  program,
  items,
  onClose,
}: Props) {
  return (
    <div
      className={sharedStyles.modalOverlay}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`${sharedStyles.modal} ${styles.previewModal}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="challenge-participant-preview-title"
      >
        <div className={sharedStyles.modalHeader}>
          <h2
            id="challenge-participant-preview-title"
            className={sharedStyles.modalTitle}
          >
            参加者画面プレビュー
          </h2>
          <button
            type="button"
            className={sharedStyles.modalCloseButton}
            onClick={onClose}
            aria-label="閉じる"
          >
            ×
          </button>
        </div>
        <div className={`${sharedStyles.modalBody} ${styles.previewBody}`}>
          <p className={sharedStyles.modalDescription}>
            保存済みの下書き内容を、参加者画面の見た目で確認できます。回答の保存や写真アップロードはできません。
          </p>
          <div className={styles.phoneFrame} aria-label="スマホ表示プレビュー">
            <div className={styles.phoneScreen}>
              <ChallengeScreen preview={{ program, items }} />
            </div>
          </div>
        </div>
        <div className={sharedStyles.modalFooter}>
          <button
            type="button"
            className={sharedStyles.primaryButton}
            onClick={onClose}
          >
            プレビューを閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
