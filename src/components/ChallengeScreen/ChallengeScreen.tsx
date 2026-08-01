import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../core/contexts/useAuth';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import type { ChallengeItem, ChallengeProgram } from '../../core/types/challengeProgram';
import type {
  ChallengeResponse,
  ChallengeResponseVisibility,
} from '../../core/types/challengeResponse';
import {
  listMyChallengeResponses,
  listPublishedChallengeItems,
  listPublishedChallengePrograms,
} from '../../core/utils/challengeResponsesApi';
import {
  listMyChallengeCompletions,
  listMyChallengeRewards,
  submitChallengeCommentResponse,
} from '../../core/utils/challengeRewardsApi';
import { getChallengeHossiiImageUrl } from '../../core/assets/challengeHossiiKeys';
import type { ChallengeCompletion, ChallengeReward } from '../../core/types/challengeReward';
import {
  buildChallengeStampSlots,
  compareChallengeItems,
  getChallengeListCtaLabel,
  getChallengeListProgress,
  hasUnansweredRequiredChallengeItems,
  pickNextChallengeFocusItemId,
  type ChallengeListProgress,
} from '../../core/utils/challengeStampProgress';
import { TopRightMenu } from '../Navigation/TopRightMenu';
import { ChallengeItemCard } from './ChallengeItemCard';
import {
  ChallengeProgressSummary,
  ChallengeStampCard,
} from './ChallengeStampCard';
import styles from './ChallengeScreen.module.css';

type View =
  | { kind: 'list' }
  | { kind: 'detail'; programId: string };

const LIST_LOAD_ERROR_TITLE = '挑戦状を読み込めませんでした';
const LIST_LOAD_ERROR_HINT = '時間をおいて、もう一度試してください';
const LIST_DECOR_HOSSII = getChallengeHossiiImageUrl('emotion/kirakira');

function toParticipantSaveError(message: string): string {
  const lower = message.toLowerCase();
  if (/must not be empty|comment is required|empty/.test(lower)) {
    return 'コメントを入力してください';
  }
  if (/at most|too long|length|500|501/.test(lower)) {
    return 'コメントは500文字以内で入力してください';
  }
  if (/権限|permission|rls|policy|jwt|auth/.test(lower)) {
    return 'この回答を保存する権限がありません';
  }
  if (/relation|postgres|pgrst|supabase|stack|syntax|uuid/.test(lower)) {
    return '回答を保存できませんでした。時間をおいてもう一度試してください';
  }
  if (/[ぁ-んァ-ン一-龥]/.test(message)) return message;
  return '回答を保存できませんでした。時間をおいてもう一度試してください';
}

function ListIntro({ menu = true }: { menu?: boolean }) {
  return (
    <div className={styles.header}>
      <div className={styles.listIntro}>
        <div className={styles.listIntroText}>
          <h1 className={styles.listTitle}>Hossiiからの挑戦状</h1>
          <p className={styles.listLead}>コメントで答えて、Hossiiを集めよう</p>
        </div>
        <img className={styles.listDecor} src={LIST_DECOR_HOSSII} alt="" />
      </div>
      {menu ? <TopRightMenu /> : null}
    </div>
  );
}

function ProgramProgressBar({
  progress,
  title,
}: {
  progress: ChallengeListProgress;
  title: string;
}) {
  const ratio =
    progress.total > 0 ? Math.min(progress.achieved / progress.total, 1) : 0;
  const statusText = progress.isComplete
    ? 'クリア済み'
    : progress.total === 0
      ? '項目はまだありません'
      : progress.started
        ? `あと${progress.remaining}つ`
        : `全${progress.total}問`;

  return (
    <div className={styles.progressBlock}>
      <div className={styles.progressMeta}>
        <span>
          {progress.achieved} / {progress.total} 達成
        </span>
        <span className={progress.isComplete ? styles.progressClear : undefined}>
          {statusText}
        </span>
      </div>
      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.achieved}
        aria-label={`${title}の進捗：${progress.achieved} / ${progress.total} 達成`}
      >
        <div
          className={styles.progressFill}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

export const ChallengeScreen = () => {
  const { currentUser } = useAuth();
  const { state, activeSpaceMembershipStatus } = useHossiiStore();
  const activeSpace = state.spaces.find((s) => s.id === state.activeSpaceId) ?? null;

  const [view, setView] = useState<View>({ kind: 'list' });
  const [programs, setPrograms] = useState<ChallengeProgram[]>([]);
  const [listProgressByProgram, setListProgressByProgram] = useState<
    Record<string, ChallengeListProgress>
  >({});
  const [items, setItems] = useState<ChallengeItem[]>([]);
  const [myResponses, setMyResponses] = useState<Record<string, ChallengeResponse>>({});
  const [activeProgram, setActiveProgram] = useState<ChallengeProgram | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [drafts, setDrafts] = useState<
    Record<string, { comment: string; visibility: ChallengeResponseVisibility }>
  >({});
  const [myRewards, setMyRewards] = useState<Record<string, ChallengeReward>>({});
  const [myCompletions, setMyCompletions] = useState<Record<string, ChallengeCompletion>>(
    {},
  );
  const [rewardModal, setRewardModal] = useState<ChallengeReward | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [pendingActiveAfterModal, setPendingActiveAfterModal] = useState<
    string | null
  >(null);

  const stampSlots = useMemo(
    () =>
      buildChallengeStampSlots(
        items,
        Object.values(myCompletions),
        Object.values(myRewards),
      ),
    [items, myCompletions, myRewards],
  );

  const sortedItems = useMemo(
    () => [...items].sort(compareChallengeItems),
    [items],
  );

  const answeredIds = useMemo(
    () => new Set(Object.keys(myResponses)),
    [myResponses],
  );

  const focusItemId = useMemo(
    () => pickNextChallengeFocusItemId(sortedItems, answeredIds),
    [sortedItems, answeredIds],
  );

  const focusSectionKind = useMemo(() => {
    if (!focusItemId) return null;
    return hasUnansweredRequiredChallengeItems(sortedItems, answeredIds)
      ? 'required'
      : 'optional';
  }, [focusItemId, sortedItems, answeredIds]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3000);
  }, []);

  const canAccess =
    Boolean(currentUser?.uid) &&
    activeSpace != null &&
    (activeSpaceMembershipStatus === 'active' ||
      activeSpaceMembershipStatus === 'idle');

  const reloadList = useCallback(async () => {
    if (!activeSpace || !currentUser?.uid) {
      setPrograms([]);
      setListProgressByProgram({});
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const listed = await listPublishedChallengePrograms(activeSpace.id);
      setPrograms(listed);
      const progressByProgram: Record<string, ChallengeListProgress> = {};
      await Promise.all(
        listed.map(async (program) => {
          const programItems = await listPublishedChallengeItems(program.id);
          const itemIds = programItems.map((i) => i.id);
          const completions = await listMyChallengeCompletions(itemIds);
          progressByProgram[program.id] = getChallengeListProgress(
            programItems,
            completions.map((completion) => completion.itemId),
          );
        }),
      );
      setListProgressByProgram(progressByProgram);
    } catch {
      setLoadError(LIST_LOAD_ERROR_TITLE);
      setPrograms([]);
      setListProgressByProgram({});
    } finally {
      setLoading(false);
    }
  }, [activeSpace, currentUser?.uid]);

  useEffect(() => {
    void reloadList();
  }, [reloadList]);

  // Space switch must not keep previous space detail / stamp / list progress.
  useEffect(() => {
    setView({ kind: 'list' });
    setActiveProgram(null);
    setItems([]);
    setMyResponses({});
    setMyRewards({});
    setMyCompletions({});
    setDrafts({});
    setFormError(null);
    setRewardModal(null);
    setActiveItemId(null);
    setPendingActiveAfterModal(null);
    setPrograms([]);
    setListProgressByProgram({});
    setLoadError(null);
    setLoading(Boolean(activeSpace?.id && currentUser?.uid));
  }, [activeSpace?.id, currentUser?.uid]);

  const openDetail = async (programId: string) => {
    setFormError(null);
    setBusyItemId('__open__');
    try {
      const listed = await listPublishedChallengePrograms(activeSpace!.id);
      const program = listed.find((p) => p.id === programId) ?? null;
      if (!program) {
        setFormError('公開中の挑戦状が見つかりません');
        return;
      }
      const programItems = await listPublishedChallengeItems(programId);
      const itemIds = programItems.map((i) => i.id);
      const [mine, rewards, completions] = await Promise.all([
        listMyChallengeResponses(itemIds),
        listMyChallengeRewards(itemIds),
        listMyChallengeCompletions(itemIds),
      ]);
      const byItem: Record<string, ChallengeResponse> = {};
      const rewardByItem: Record<string, ChallengeReward> = {};
      const completionByItem: Record<string, ChallengeCompletion> = {};
      const nextDrafts: Record<
        string,
        { comment: string; visibility: ChallengeResponseVisibility }
      > = {};
      for (const entry of programItems) {
        const existing = mine.find((r) => r.itemId === entry.id);
        if (existing) byItem[entry.id] = existing;
        const reward = rewards.find((r) => r.itemId === entry.id);
        if (reward) rewardByItem[entry.id] = reward;
        const completion = completions.find((c) => c.itemId === entry.id);
        if (completion) completionByItem[entry.id] = completion;
        nextDrafts[entry.id] = {
          comment: existing?.comment ?? '',
          visibility: existing?.visibility ?? 'manager_only',
        };
      }
      setActiveProgram(program);
      setItems(programItems);
      setMyResponses(byItem);
      setMyRewards(rewardByItem);
      setMyCompletions(completionByItem);
      setDrafts(nextDrafts);
      setActiveItemId(
        pickNextChallengeFocusItemId(
          programItems,
          Object.keys(byItem),
        ),
      );
      setPendingActiveAfterModal(null);
      setView({ kind: 'detail', programId });
    } catch {
      setFormError('挑戦状の詳細を読み込めませんでした');
    } finally {
      setBusyItemId(null);
    }
  };

  const closeRewardModal = (goToList: boolean) => {
    setRewardModal(null);
    if (goToList) {
      setPendingActiveAfterModal(null);
      setActiveItemId(null);
      setView({ kind: 'list' });
      void reloadList();
      return;
    }
    setActiveItemId(pendingActiveAfterModal);
    setPendingActiveAfterModal(null);
  };

  const saveResponse = async (item: ChallengeItem) => {
    if (busyItemId) return;
    const draft = drafts[item.id] ?? {
      comment: '',
      visibility: 'manager_only' as const,
    };
    const trimmed = draft.comment.trim();
    if (!trimmed) {
      setFormError('コメントを入力してください');
      return;
    }
    if (trimmed.length > 500) {
      setFormError('コメントは500文字以内で入力してください');
      return;
    }
    const hadResponse = Boolean(myResponses[item.id]);
    setBusyItemId(item.id);
    setFormError(null);
    try {
      const result = await submitChallengeCommentResponse({
        itemId: item.id,
        comment: draft.comment,
        visibility: draft.visibility,
      });
      if (!result.ok) {
        setFormError(toParticipantSaveError(result.error));
        return;
      }
      const nextResponses: Record<string, ChallengeResponse> = {
        ...myResponses,
        [item.id]: {
          id: result.value.response.id,
          itemId: result.value.response.itemId,
          userId: result.value.response.userId,
          visibility: result.value.response.visibility,
          comment: result.value.response.comment,
          createdAt: result.value.response.createdAt,
          updatedAt: result.value.response.updatedAt,
        },
      };
      setMyResponses(nextResponses);
      setMyRewards((prev) => ({ ...prev, [item.id]: result.value.reward }));
      setMyCompletions((prev) => ({
        ...prev,
        [item.id]: result.value.completion,
      }));
      setDrafts((prev) => ({
        ...prev,
        [item.id]: {
          comment: result.value.response.comment,
          visibility: result.value.response.visibility,
        },
      }));
      const nextFocus = pickNextChallengeFocusItemId(
        items,
        Object.keys(nextResponses),
      );
      if (result.value.isNewReward) {
        setPendingActiveAfterModal(nextFocus);
        setRewardModal(result.value.reward);
      } else if (hadResponse) {
        showToast('回答を更新しました');
      } else {
        setActiveItemId(nextFocus);
        showToast('回答を保存しました');
      }
    } finally {
      setBusyItemId(null);
    }
  };

  if (!currentUser?.uid) {
    return (
      <div className={styles.container}>
        <ListIntro />
        <p className={styles.muted}>ログインしたスペース参加者のみ利用できます。</p>
      </div>
    );
  }

  if (!activeSpace) {
    return (
      <div className={styles.container}>
        <ListIntro />
        <p className={styles.muted}>スペースを選択してください。</p>
      </div>
    );
  }

  if (activeSpaceMembershipStatus === 'none' || activeSpaceMembershipStatus === 'error') {
    return (
      <div className={styles.container}>
        <ListIntro />
        <p className={styles.muted}>このスペースの参加者のみ挑戦状に回答できます。</p>
      </div>
    );
  }

  if (view.kind === 'detail' && activeProgram) {
    const focusItem = focusItemId
      ? sortedItems.find((item) => item.id === focusItemId) ?? null
      : null;
    const answeredItems = sortedItems.filter((item) => answeredIds.has(item.id));
    const queuedItems = sortedItems.filter(
      (item) => !answeredIds.has(item.id) && item.id !== focusItemId,
    );
    const detailProgress = getChallengeListProgress(
      sortedItems,
      answeredIds,
    );

    const renderItemCard = (
      item: ChallengeItem,
      index: number,
      emphasized: boolean,
    ) => {
      const draft = drafts[item.id] ?? {
        comment: '',
        visibility: 'manager_only' as const,
      };
      return (
        <ChallengeItemCard
          key={item.id}
          item={item}
          index={index}
          existing={myResponses[item.id]}
          draft={draft}
          saving={busyItemId === item.id}
          expanded={activeItemId === item.id}
          emphasized={emphasized}
          panelId={`challenge-item-panel-${item.id}`}
          orphanRewardNote={!myResponses[item.id] && Boolean(myRewards[item.id])}
          onExpand={() => setActiveItemId(item.id)}
          onCollapse={() => setActiveItemId(null)}
          onDraftChange={(next) =>
            setDrafts((prev) => ({ ...prev, [item.id]: next }))
          }
          onSave={() => void saveResponse(item)}
        />
      );
    };

    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.titleBlock}>
            <button
              type="button"
              className={styles.backButton}
              onClick={() => {
                setView({ kind: 'list' });
                setActiveItemId(null);
                setPendingActiveAfterModal(null);
                void reloadList();
              }}
            >
              ← 一覧へ戻る
            </button>
            <h1 className={styles.title}>{activeProgram.title}</h1>
            {activeProgram.description && (
              <p className={styles.subtitle}>{activeProgram.description}</p>
            )}
          </div>
          <TopRightMenu />
        </div>

        {formError && (
          <p className={styles.error} role="alert">
            {formError}
          </p>
        )}

        <ChallengeProgressSummary slots={stampSlots} />

        {sortedItems.length === 0 ? (
          <div className={styles.detailEmpty}>
            この挑戦状には、まだ質問がありません
          </div>
        ) : (
          <>
            {detailProgress.isComplete && !focusItem ? (
              <p className={styles.detailStatus} aria-live="polite">
                挑戦状をクリアしました。回答済みの内容を振り返れます。
              </p>
            ) : detailProgress.isComplete && focusItem ? (
              <p className={styles.detailStatus} aria-live="polite">
                必須の挑戦はクリアしました
              </p>
            ) : null}

            {focusItem ? (
              <section
                className={styles.focusSection}
                aria-labelledby="challenge-focus-heading"
              >
                <h2 id="challenge-focus-heading" className={styles.focusHeading}>
                  {focusSectionKind === 'optional' ? 'おまけの挑戦' : '次の挑戦'}
                </h2>
                <p className={styles.focusLead}>
                  {focusSectionKind === 'optional'
                    ? 'もっとHossiiを集めたい人へ'
                    : 'まずはこの質問に答えてみよう'}
                </p>
                <ul className={styles.itemList}>
                  {renderItemCard(
                    focusItem,
                    sortedItems.findIndex((item) => item.id === focusItem.id) + 1,
                    true,
                  )}
                </ul>
              </section>
            ) : null}

            <ChallengeStampCard key={activeProgram.id} slots={stampSlots} />

            {answeredItems.length > 0 ? (
              <section
                className={styles.groupSection}
                aria-labelledby="challenge-answered-heading"
              >
                <h2 id="challenge-answered-heading" className={styles.groupHeading}>
                  回答済み
                </h2>
                <ul className={styles.itemList}>
                  {answeredItems.map((item) =>
                    renderItemCard(
                      item,
                      sortedItems.findIndex((entry) => entry.id === item.id) + 1,
                      false,
                    ),
                  )}
                </ul>
              </section>
            ) : null}

            {queuedItems.length > 0 ? (
              <section
                className={styles.groupSection}
                aria-labelledby="challenge-queued-heading"
              >
                <h2 id="challenge-queued-heading" className={styles.groupHeading}>
                  これから答える
                </h2>
                <ul className={styles.itemList}>
                  {queuedItems.map((item) =>
                    renderItemCard(
                      item,
                      sortedItems.findIndex((entry) => entry.id === item.id) + 1,
                      false,
                    ),
                  )}
                </ul>
              </section>
            ) : null}
          </>
        )}

        {toast && (
          <div className={styles.toast} aria-live="polite">
            {toast}
          </div>
        )}
        {rewardModal && (
          <div className={styles.rewardOverlay} role="dialog" aria-modal="true">
            <div className={styles.rewardCard}>
              <p className={styles.rewardEyebrow}>Hossiiゲット！</p>
              <img
                className={styles.rewardImage}
                src={getChallengeHossiiImageUrl(rewardModal.hossiiKey)}
                alt="新しいHossii"
              />
              <p className={styles.rewardTitle}>新しいHossiiが仲間になりました</p>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => closeRewardModal(false)}
                >
                  閉じる
                </button>
                <button
                  type="button"
                  className={styles.ghostButton}
                  onClick={() => closeRewardModal(true)}
                >
                  次の挑戦状へ
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <ListIntro />

      {loading && (
        <div className={styles.listLoading} aria-busy="true" aria-live="polite">
          <p className={styles.muted}>挑戦状をひろっています…</p>
          <div className={styles.skeletonCard} />
          <div className={styles.skeletonCard} />
        </div>
      )}

      {!loading && loadError && (
        <div className={styles.listError} role="alert">
          <p className={styles.listErrorTitle}>{LIST_LOAD_ERROR_TITLE}</p>
          <p className={styles.muted}>{LIST_LOAD_ERROR_HINT}</p>
          <button
            type="button"
            className={styles.listRetryButton}
            onClick={() => void reloadList()}
          >
            もう一度読み込む
          </button>
        </div>
      )}

      {!loading && !loadError && programs.length === 0 && (
        <div className={styles.emptyState}>
          <img className={styles.emptyDecor} src={LIST_DECOR_HOSSII} alt="" />
          <p className={styles.emptyTitle}>いま挑戦できるストーリーはありません</p>
          <p className={styles.muted}>
            新しい挑戦状が届くまで、少し待っていてね
          </p>
        </div>
      )}

      {!loading && !loadError && programs.length > 0 && (
        <ul className={styles.programList}>
          {programs.map((program) => {
            const progress =
              listProgressByProgram[program.id] ??
              getChallengeListProgress([], []);
            const ctaLabel = getChallengeListCtaLabel(progress);
            return (
              <li key={program.id} className={styles.programCard}>
                <h2 className={styles.programTitle}>{program.title}</h2>
                {program.description ? (
                  <p className={styles.programDescription}>{program.description}</p>
                ) : null}
                <ProgramProgressBar progress={progress} title={program.title} />
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.listCta}
                    disabled={!canAccess || busyItemId != null}
                    aria-label={`${ctaLabel}：${program.title}`}
                    onClick={() => void openDetail(program.id)}
                  >
                    {ctaLabel}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {formError && <p className={styles.error}>{formError}</p>}
      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  );
};
