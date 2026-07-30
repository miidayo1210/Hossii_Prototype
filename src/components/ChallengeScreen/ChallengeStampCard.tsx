import { useMediaQuery } from '../../core/hooks/useMediaQuery';
import { getChallengeHossiiImageUrl } from '../../core/assets/challengeHossiiKeys';
import {
  formatRemainingLabel,
  getChallengeStampProgress,
  getStampGridColumns,
  type ChallengeStampSlot,
} from '../../core/utils/challengeStampProgress';
import styles from './ChallengeStampCard.module.css';

type Props = {
  slots: ChallengeStampSlot[];
};

export const ChallengeStampCard = ({ slots }: Props) => {
  const narrow = useMediaQuery('(max-width: 640px)');
  const progress = getChallengeStampProgress(slots);
  const columns = getStampGridColumns(slots.length, narrow);
  const status = formatRemainingLabel(progress);

  if (slots.length === 0) {
    return null;
  }

  return (
    <section className={styles.section} aria-label="Hossiiスタンプカード">
      <div className={styles.progressRow}>
        {progress.treatsAllAsOptional ? (
          <span>
            達成{' '}
            <span className={styles.progressStrong}>
              {progress.optionalDone + progress.requiredDone} / {slots.length}
            </span>
          </span>
        ) : (
          <>
            <span>
              必須{' '}
              <span className={styles.progressStrong}>
                {progress.requiredDone} / {progress.requiredTotal}
              </span>
            </span>
            {progress.optionalTotal > 0 && (
              <span>
                おまけ{' '}
                <span className={styles.progressStrong}>
                  {progress.optionalDone} / {progress.optionalTotal}
                </span>
              </span>
            )}
          </>
        )}
      </div>
      <p
        className={`${styles.statusLine} ${
          progress.isComplete ? '' : styles.statusLinePending
        }`}
      >
        {status}
      </p>
      <p className={styles.hint}>
        一度獲得したHossiiスタンプは、回答を削除しても残ります。
      </p>
      <ul
        className={styles.grid}
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {slots.map((slot) => {
          const typeLabel = slot.item.itemType === 'question' ? '質問' : 'ミッション';
          const requiredLabel = slot.item.isRequired ? '必須' : 'おまけ';
          const stateLabel = slot.achieved ? '達成済み' : '未達成';
          return (
            <li
              key={slot.item.id}
              className={`${styles.slot} ${slot.achieved ? styles.slotAchieved : ''}`}
            >
              <span className={styles.slotIndex}>#{slot.index}</span>
              <p className={styles.slotTitle}>{slot.item.title}</p>
              <span className={styles.slotMeta}>
                {typeLabel}・{requiredLabel}
              </span>
              <div className={styles.stampArea}>
                {slot.achieved && slot.hossiiKey ? (
                  <img
                    className={styles.stampImage}
                    src={getChallengeHossiiImageUrl(slot.hossiiKey)}
                    alt={`獲得Hossii（${slot.item.title}）`}
                  />
                ) : (
                  <span className={styles.emptyStamp} aria-hidden="true" />
                )}
                <span
                  className={`${styles.stateText} ${
                    slot.achieved ? '' : styles.stateTextEmpty
                  }`}
                >
                  {stateLabel}
                  {slot.achieved && !slot.hossiiKey ? '（画像なし）' : ''}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
