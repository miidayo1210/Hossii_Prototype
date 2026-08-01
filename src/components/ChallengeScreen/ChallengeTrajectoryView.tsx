import type { ChallengeProgram } from '../../core/types/challengeProgram';
import type { ChallengeResponse } from '../../core/types/challengeResponse';
import {
  formatOptionalLeftoverLabel,
  formatRemainingLabel,
  getChallengeStampProgress,
  type ChallengeStampSlot,
} from '../../core/utils/challengeStampProgress';
import { ChallengeStampCard } from './ChallengeStampCard';
import styles from './ChallengeTrajectoryView.module.css';

type ChallengeTrajectoryEntry = {
  slot: ChallengeStampSlot;
  response: ChallengeResponse | null;
};

type Props = {
  program: ChallengeProgram;
  slots: ChallengeStampSlot[];
  responsesByItemId: Record<string, ChallengeResponse | undefined>;
  onBack: () => void;
  /** Defaults to 「← 挑戦状へ戻る」 */
  backLabel?: string;
  onOpenRecord?: (itemId: string) => void;
};

function formatDate(date: Date | null | undefined): string | null {
  if (!date) return null;
  try {
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  } catch {
    return null;
  }
}

function buildEntries(
  slots: ChallengeStampSlot[],
  responsesByItemId: Record<string, ChallengeResponse | undefined>,
): ChallengeTrajectoryEntry[] {
  return slots.map((slot) => ({
    slot,
    response: responsesByItemId[slot.item.id] ?? null,
  }));
}

function entrySortKey(entry: ChallengeTrajectoryEntry): number {
  const completed = entry.slot.completion?.completedAt?.getTime();
  if (completed != null) return completed;
  const responded = entry.response?.createdAt?.getTime();
  if (responded != null) return responded;
  return Number.MAX_SAFE_INTEGER;
}

export function ChallengeTrajectoryView({
  program,
  slots,
  responsesByItemId,
  onBack,
  backLabel = '← 挑戦状へ戻る',
  onOpenRecord,
}: Props) {
  const progress = getChallengeStampProgress(slots);
  const entries = buildEntries(slots, responsesByItemId).sort((a, b) => {
    const byTime = entrySortKey(a) - entrySortKey(b);
    if (byTime !== 0) return byTime;
    return a.slot.index - b.slot.index;
  });
  const leftover = formatOptionalLeftoverLabel(progress);
  const status = formatRemainingLabel(progress);
  const complete = progress.isComplete;
  const answeredEntries = entries.filter(
    (entry) => entry.slot.achieved || entry.response,
  );

  return (
    <div className={styles.page}>
      <div className={styles.chrome}>
        <button type="button" className={styles.backButton} onClick={onBack}>
          {backLabel}
        </button>
      </div>

      <article
        className={`${styles.artwork} ${complete ? styles.artworkComplete : ''}`}
        data-challenge-trajectory-export="true"
        aria-label="挑戦の記録"
      >
        <header className={styles.hero}>
          <p className={styles.kicker}>挑戦の記録</p>
          <h1 className={styles.title}>{program.title}</h1>
          <div className={styles.statusRow}>
            {complete ? (
              <span className={styles.clearAccent}>クリア</span>
            ) : (
              <span className={styles.progressAccent}>進行中</span>
            )}
            <span className={styles.statusText}>{status}</span>
          </div>
          {leftover ? <p className={styles.leftover}>{leftover}</p> : null}
        </header>

        <section className={styles.stampBlock} aria-label="スタンプ">
          <ChallengeStampCard
            slots={slots}
            onSelectAchieved={
              onOpenRecord
                ? (slot) => onOpenRecord(slot.item.id)
                : undefined
            }
          />
        </section>

        <section className={styles.timeline} aria-label="回答記録">
          <h2 className={styles.sectionLabel}>回答記録</h2>
          {answeredEntries.length === 0 ? (
            <p className={styles.emptyHint}>まだ回答はありません</p>
          ) : (
            <ol className={styles.entryList}>
              {answeredEntries.map(({ slot, response }) => {
                const item = slot.item;
                const typeLabel =
                  item.itemType === 'question' ? '質問' : 'ミッション';
                const requiredLabel = item.isRequired ? '必須' : 'おまけ';
                const dateLabel = formatDate(
                  slot.completion?.completedAt ?? response?.createdAt,
                );

                return (
                  <li
                    key={item.id}
                    className={`${styles.entry} ${
                      slot.achieved ? styles.entryDone : ''
                    }`}
                  >
                    <div className={styles.entryBody}>
                      <div className={styles.entryMeta}>
                        <span>
                          {slot.index}. {typeLabel} · {requiredLabel}
                        </span>
                        {dateLabel ? <span>{dateLabel}</span> : null}
                      </div>
                      <h3 className={styles.entryTitle}>{item.title}</h3>
                      {response ? (
                        <p className={styles.entryAnswer}>
                          {response.comment || '（回答なし）'}
                        </p>
                      ) : (
                        <p className={styles.entryDeleted}>回答は削除済みです</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </article>
    </div>
  );
}
