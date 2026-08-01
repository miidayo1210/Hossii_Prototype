import { getChallengeHossiiImageUrl } from '../../core/assets/challengeHossiiKeys';
import type { ChallengeProgram } from '../../core/types/challengeProgram';
import type { ChallengeResponse } from '../../core/types/challengeResponse';
import {
  formatCollectedHossiiLabel,
  formatOptionalLeftoverLabel,
  formatRemainingLabel,
  getChallengeStampProgress,
  type ChallengeStampSlot,
} from '../../core/utils/challengeStampProgress';
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
}: Props) {
  const progress = getChallengeStampProgress(slots);
  const entries = buildEntries(slots, responsesByItemId).sort((a, b) => {
    const byTime = entrySortKey(a) - entrySortKey(b);
    if (byTime !== 0) return byTime;
    return a.slot.index - b.slot.index;
  });
  const collected = slots.length > 0 ? formatCollectedHossiiLabel(slots) : null;
  const leftover = formatOptionalLeftoverLabel(progress);
  const status = formatRemainingLabel(progress);
  const complete = progress.isComplete;
  const achievedSlots = slots.filter((slot) => slot.achieved && slot.hossiiKey);

  return (
    <div className={styles.page}>
      <div className={styles.chrome}>
        <button type="button" className={styles.backButton} onClick={onBack}>
          ← 挑戦状へ戻る
        </button>
      </div>

      {/* Export-friendly artwork root (PDF/画像出力は次PR) */}
      <article
        className={`${styles.artwork} ${complete ? styles.artworkComplete : ''}`}
        data-challenge-trajectory-export="true"
        aria-label={complete ? '完成した軌跡' : 'わたしの軌跡'}
      >
        <header className={styles.hero}>
          <p className={styles.kicker}>
            {complete ? '完成した軌跡' : 'わたしの軌跡'}
          </p>
          <h1 className={styles.title}>{program.title}</h1>
          {program.description ? (
            <p className={styles.description}>{program.description}</p>
          ) : null}
          <div className={styles.statusRow}>
            {complete ? (
              <span className={styles.clearAccent}>クリア</span>
            ) : (
              <span className={styles.progressAccent}>途中経過</span>
            )}
            <span className={styles.statusText}>{status}</span>
          </div>
          {collected ? <p className={styles.collected}>{collected}</p> : null}
          {leftover ? <p className={styles.leftover}>{leftover}</p> : null}
        </header>

        {achievedSlots.length > 0 ? (
          <section className={styles.hossiiStrip} aria-label="集めたHossii">
            <h2 className={styles.sectionLabel}>集めたHossii</h2>
            <ul className={styles.hossiiRow}>
              {achievedSlots.map((slot) => (
                <li key={slot.item.id} className={styles.hossiiChip}>
                  <img
                    src={getChallengeHossiiImageUrl(slot.hossiiKey!)}
                    alt=""
                    className={styles.hossiiThumb}
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <p className={styles.emptyHint}>まだHossiiは集まっていません</p>
        )}

        <section className={styles.timeline} aria-label="挑戦の軌跡">
          <h2 className={styles.sectionLabel}>挑戦のきろく</h2>
          <ol className={styles.entryList}>
            {entries.map(({ slot, response }) => {
              const item = slot.item;
              const typeLabel = item.itemType === 'question' ? '質問' : 'ミッション';
              const requiredLabel = item.isRequired ? '必須' : 'おまけ';
              const dateLabel = formatDate(
                slot.completion?.completedAt ?? response?.createdAt,
              );
              const pending = !slot.achieved && !response;

              return (
                <li
                  key={item.id}
                  className={`${styles.entry} ${
                    slot.achieved ? styles.entryDone : styles.entryPending
                  }`}
                >
                  <div className={styles.entryMedia}>
                    {slot.achieved && slot.hossiiKey ? (
                      <img
                        className={styles.entryHossii}
                        src={getChallengeHossiiImageUrl(slot.hossiiKey)}
                        alt=""
                      />
                    ) : (
                      <span className={styles.entryEmpty} aria-hidden="true" />
                    )}
                  </div>
                  <div className={styles.entryBody}>
                    <div className={styles.entryMeta}>
                      <span>
                        {slot.index}. {typeLabel} · {requiredLabel}
                      </span>
                      {dateLabel ? <span>{dateLabel}</span> : null}
                    </div>
                    <h3 className={styles.entryTitle}>{item.title}</h3>
                    {pending ? (
                      <p className={styles.entryPendingNote}>まだこれから</p>
                    ) : response ? (
                      <p className={styles.entryAnswer}>{response.comment || '（回答なし）'}</p>
                    ) : (
                      <p className={styles.entryDeleted}>
                        回答はそっとしまってあります。Hossiiのきおくはそのまま。
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <footer className={styles.footer}>
          {complete
            ? 'この軌跡は、あなたが積み重ねた気持ちのかたちです'
            : 'つづきの挑戦が、この軌跡を育てていきます'}
        </footer>
      </article>
    </div>
  );
}
