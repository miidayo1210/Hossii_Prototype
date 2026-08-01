import { useId, useState } from 'react';
import { useMediaQuery } from '../../core/hooks/useMediaQuery';
import { getChallengeHossiiImageUrl } from '../../core/assets/challengeHossiiKeys';
import {
  formatCollectedHossiiLabel,
  formatOptionalLeftoverLabel,
  formatRemainingLabel,
  getChallengeStampProgress,
  getStampGridColumns,
  getStampPreviewLimit,
  shouldAutoExpandStampDetails,
  type ChallengeStampSlot,
} from '../../core/utils/challengeStampProgress';
import styles from './ChallengeStampCard.module.css';

type Props = {
  slots: ChallengeStampSlot[];
  onSelectAchieved?: (slot: ChallengeStampSlot) => void;
  onSelectPending?: (slot: ChallengeStampSlot) => void;
};

function StampSlotCell({
  slot,
  onSelectAchieved,
  onSelectPending,
}: {
  slot: ChallengeStampSlot;
  onSelectAchieved?: (slot: ChallengeStampSlot) => void;
  onSelectPending?: (slot: ChallengeStampSlot) => void;
}) {
  const typeLabel = slot.item.itemType === 'question' ? '質問' : 'ミッション';
  const requiredLabel = slot.item.isRequired ? 'クリアに必要' : 'おまけ';
  const stateLabel = slot.achieved
    ? slot.hossiiKey
      ? 'GET!'
      : '獲得済み'
    : 'まだ';
  const ariaLabel = slot.achieved
    ? `${slot.item.title}のスタンプを振り返る、${typeLabel}、${requiredLabel}、獲得済み`
    : `${slot.item.title}に答える、${typeLabel}、${requiredLabel}、未獲得`;

  const stampVisual =
    slot.achieved && slot.hossiiKey ? (
      <img
        className={styles.stampImage}
        src={getChallengeHossiiImageUrl(slot.hossiiKey)}
        alt=""
      />
    ) : (
      <span
        className={`${styles.emptyStamp} ${
          slot.achieved ? styles.emptyStampAchieved : ''
        }`}
        aria-hidden="true"
      />
    );

  return (
    <li className={`${styles.slot} ${slot.achieved ? styles.slotAchieved : styles.slotPending}`}>
      <button
        type="button"
        className={styles.slotButton}
        aria-label={ariaLabel}
        onClick={() => {
          if (slot.achieved) onSelectAchieved?.(slot);
          else onSelectPending?.(slot);
        }}
      >
        <div className={styles.stampArea}>
          {stampVisual}
          <span
            className={`${styles.stateChip} ${
              slot.achieved ? styles.stateChipGot : styles.stateChipEmpty
            }`}
          >
            {stateLabel}
            {slot.achieved && !slot.hossiiKey ? '（画像なし）' : ''}
          </span>
        </div>
        <p className={styles.slotTitle}>{slot.item.title}</p>
      </button>
    </li>
  );
}

export function ChallengeProgressSummary({ slots }: Props) {
  const progress = getChallengeStampProgress(slots);
  const status = formatRemainingLabel(progress);
  const optionalLeftover = formatOptionalLeftoverLabel(progress);
  const collected =
    progress.isComplete && slots.length > 0
      ? formatCollectedHossiiLabel(slots)
      : null;

  if (slots.length === 0) {
    return null;
  }

  const clearRatio = progress.treatsAllAsOptional
    ? (progress.optionalDone + progress.requiredDone) / slots.length
    : progress.requiredTotal > 0
      ? progress.requiredDone / progress.requiredTotal
      : 0;

  return (
    <section
      className={`${styles.summary} ${
        progress.isComplete ? styles.summaryClear : ''
      }`}
      aria-label="挑戦状の進捗"
    >
      {progress.isComplete ? (
        <p className={styles.clearBadge} aria-hidden="true">
          クリア！
        </p>
      ) : null}
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
      <div
        className={styles.summaryTrack}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={
          progress.treatsAllAsOptional ? slots.length : progress.requiredTotal
        }
        aria-valuenow={
          progress.treatsAllAsOptional
            ? progress.optionalDone + progress.requiredDone
            : progress.requiredDone
        }
        aria-label="クリアまでの進捗"
      >
        <div
          className={styles.summaryFill}
          style={{ width: `${Math.min(clearRatio, 1) * 100}%` }}
        />
      </div>
      <p
        className={`${styles.statusLine} ${
          progress.isComplete ? '' : styles.statusLinePending
        }`}
        aria-live="polite"
      >
        {status}
      </p>
      {collected ? <p className={styles.collectedLine}>{collected}</p> : null}
      {optionalLeftover ? (
        <p className={styles.optionalLine}>{optionalLeftover}</p>
      ) : null}
    </section>
  );
}

export const ChallengeStampCard = ({
  slots,
  onSelectAchieved,
  onSelectPending,
}: Props) => {
  const narrow = useMediaQuery('(max-width: 640px)');
  const panelId = useId();
  const progress = getChallengeStampProgress(slots);
  const columns = getStampGridColumns(slots.length, narrow);
  const achievedCount = slots.filter((slot) => slot.achieved).length;
  const autoExpand = shouldAutoExpandStampDetails(slots.length);
  const [expanded, setExpanded] = useState(autoExpand);

  if (slots.length === 0) {
    return null;
  }

  const previewLimit = getStampPreviewLimit(slots.length);
  const previewSlots = slots.slice(0, previewLimit);
  const moreCount = Math.max(slots.length - previewLimit, 0);

  return (
    <section className={styles.section} aria-label="Hossiiスタンプカード">
      <div className={styles.detailHeader}>
        <div>
          <h2 className={styles.detailTitle}>スタンプカード</h2>
          <p className={styles.detailMeta}>
            {achievedCount} / {slots.length} 獲得
          </p>
        </div>
        {!autoExpand ? (
          <button
            type="button"
            className={styles.toggleButton}
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? 'スタンプを閉じる' : 'スタンプを見る'}
          </button>
        ) : null}
      </div>

      {!expanded && !autoExpand ? (
        <div className={styles.previewBlock}>
          <ul className={styles.previewRow} aria-label="スタンププレビュー">
            {previewSlots.map((slot) => (
              <li key={slot.item.id}>
                <button
                  type="button"
                  className={`${styles.previewSlot} ${
                    slot.achieved
                      ? styles.previewSlotAchieved
                      : styles.previewSlotPending
                  }`}
                  aria-label={
                    slot.achieved
                      ? `${slot.item.title}のスタンプを振り返る`
                      : `${slot.item.title}に答える`
                  }
                  onClick={() => {
                    if (slot.achieved) onSelectAchieved?.(slot);
                    else onSelectPending?.(slot);
                  }}
                >
                  {slot.achieved && slot.hossiiKey ? (
                    <img
                      className={styles.previewImage}
                      src={getChallengeHossiiImageUrl(slot.hossiiKey)}
                      alt=""
                    />
                  ) : (
                    <span
                      className={`${styles.previewEmpty} ${
                        slot.achieved ? styles.previewEmptyAchieved : ''
                      }`}
                      aria-hidden="true"
                    />
                  )}
                </button>
              </li>
            ))}
          </ul>
          {moreCount > 0 ? (
            <p className={styles.moreLabel}>ほか{moreCount}個</p>
          ) : null}
        </div>
      ) : null}

      {(expanded || autoExpand) && (
        <div id={panelId}>
          <p className={styles.hint}>スタンプを押して、思い出をひらこう</p>
          {progress.isComplete ? (
            <p className={styles.detailClearNote} aria-live="polite">
              {formatRemainingLabel(progress)}
            </p>
          ) : null}
          <ul
            className={styles.grid}
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {slots.map((slot) => (
              <StampSlotCell
                key={slot.item.id}
                slot={slot}
                onSelectAchieved={onSelectAchieved}
                onSelectPending={onSelectPending}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
