import styles from './SpacePanelCubeDock.module.css';

type Props = {
  quickPostOpen: boolean;
  quickLogOpen: boolean;
  speechPanelOpen: boolean;
  onQuickPostToggle: () => void;
  onQuickLogToggle: () => void;
  onSpeechPanelToggle: () => void;
  /** 訪問モードでは投稿キューブを無効 */
  postDisabled?: boolean;
  /** 訪問モードでは音声パネルキューブを無効 */
  speechDisabled?: boolean;
};

/**
 * スペース右側の「投稿」「ログ一覧」パネル用キューブ風トグル。
 * ダブル/トリプルタップの既存操作に加え、ここからも出し入れできる。
 */
export function SpacePanelCubeDock({
  quickPostOpen,
  quickLogOpen,
  speechPanelOpen,
  onQuickPostToggle,
  onQuickLogToggle,
  onSpeechPanelToggle,
  postDisabled = false,
  speechDisabled = false,
}: Props) {
  return (
    <div className={styles.dock} role="toolbar" aria-label="クイックパネル">
      <button
        type="button"
        className={`${styles.cube} ${styles.cubePost} ${quickPostOpen ? styles.cubeOpen : styles.cubeShut} ${postDisabled ? styles.cubeDisabled : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          if (!postDisabled) onQuickPostToggle();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        disabled={postDisabled}
        aria-pressed={quickPostOpen}
        aria-label={postDisabled ? '訪問中は投稿パネルを開けません' : '投稿パネルを開く・閉じる'}
        title={postDisabled ? '訪問中は投稿できません' : '投稿パネル（ダブルタップでも開閉）'}
      >
        <span className={styles.cubeFace} aria-hidden />
        <span className={styles.cubeLabel}>投稿</span>
      </button>

      <button
        type="button"
        className={`${styles.cube} ${styles.cubeLog} ${quickLogOpen ? styles.cubeOpen : styles.cubeShut}`}
        onClick={(e) => {
          e.stopPropagation();
          onQuickLogToggle();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        aria-pressed={quickLogOpen}
        aria-label="ログ一覧パネルを開く・閉じる"
        title="ログ一覧（トリプルタップでも開閉）"
      >
        <span className={styles.cubeFace} aria-hidden />
        <span className={styles.cubeLabel}>ログ</span>
      </button>

      <button
        type="button"
        className={`${styles.cube} ${styles.cubeSpeech} ${speechPanelOpen ? styles.cubeOpen : styles.cubeShut} ${speechDisabled ? styles.cubeDisabled : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          if (!speechDisabled) onSpeechPanelToggle();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        disabled={speechDisabled}
        aria-pressed={speechPanelOpen}
        aria-label={speechDisabled ? '訪問中は音声パネルを開けません' : '音声パネルを開く・閉じる'}
        title={speechDisabled ? '訪問中は利用できません' : '音声入力パネル'}
      >
        <span className={styles.cubeFace} aria-hidden />
        <span className={styles.cubeLabel}>音声</span>
      </button>
    </div>
  );
}
