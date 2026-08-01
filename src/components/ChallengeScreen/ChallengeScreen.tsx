import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  deleteChallengeResponse,
} from '../../core/utils/challengeResponsesApi';
import {
  listMyChallengeCompletions,
  listMyChallengeRewards,
  submitChallengeCommentResponse,
} from '../../core/utils/challengeRewardsApi';
import { getChallengeHossiiImageUrl } from '../../core/assets/challengeHossiiKeys';
import type { ChallengeCompletion, ChallengeReward } from '../../core/types/challengeReward';
import {
  canFetchChallengeParticipantList,
  isChallengeListAccessDenied,
  isChallengeListWaitingMembership,
  withChallengeListTimeout,
} from '../../core/utils/challengeListLoadGate';
import {
  buildChallengeStampSlots,
  compareChallengeItems,
  formatCollectedHossiiLabel,
  formatOptionalLeftoverLabel,
  formatRewardCelebrationProgressLabel,
  getChallengeListCtaLabel,
  getChallengeListOpenLabel,
  getChallengeListProgress,
  getChallengeListStatusHint,
  getChallengeListStatusLabel,
  getChallengeStampProgress,
  hasUnansweredRequiredChallengeItems,
  pickNextChallengeFocusItemId,
  resolveChallengeRewardCelebrationKind,
  type ChallengeListProgress,
  type ChallengeStampSlot,
} from '../../core/utils/challengeStampProgress';
import { TopRightMenu } from '../Navigation/TopRightMenu';
import { ChallengeItemCard } from './ChallengeItemCard';
import {
  ChallengeRewardModal,
  type ChallengeRewardModalModel,
} from './ChallengeRewardModal';
import {
  ChallengeRecallModal,
  type ChallengeRecallModalModel,
} from './ChallengeRecallModal';
import {
  ChallengeRecordsSection,
  type ChallengeRecordRow,
} from './ChallengeRecordsSection';
import {
  ChallengeProgressSummary,
  ChallengeStampCard,
} from './ChallengeStampCard';
import { ChallengeTrajectoryView } from './ChallengeTrajectoryView';
import styles from './ChallengeScreen.module.css';

type View =
  | { kind: 'list' }
  | { kind: 'detail'; programId: string }
  | { kind: 'trajectory'; programId: string };

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

function toParticipantDeleteError(message: string): string {
  const lower = message.toLowerCase();
  if (/権限|permission|rls|policy|jwt|auth/.test(lower)) {
    return 'この回答を削除する権限がありません';
  }
  if (/relation|postgres|pgrst|supabase|stack|syntax|uuid|network|fetch/.test(lower)) {
    return '回答を削除できませんでした。時間をおいてもう一度試してください';
  }
  if (/[ぁ-んァ-ン一-龥]/.test(message)) return message;
  return '回答を削除できませんでした。時間をおいてもう一度試してください';
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

function listProgressCountLabel(progress: ChallengeListProgress): string {
  if (progress.total <= 0) return '0 / 0 達成';
  if (
    progress.listStatus === 'cleared' &&
    progress.requiredTotal > 0 &&
    !progress.isCompletedAll
  ) {
    return `必須 ${progress.requiredDone} / ${progress.requiredTotal} 達成`;
  }
  return `${progress.achieved} / ${progress.total} 達成`;
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
  const countLabel = listProgressCountLabel(progress);
  const hint = getChallengeListStatusHint(progress);
  const fillClass =
    progress.listStatus === 'completed'
      ? `${styles.progressFill} ${styles.progressFillComplete}`
      : progress.listStatus === 'cleared'
        ? `${styles.progressFill} ${styles.progressFillCleared}`
        : styles.progressFill;

  return (
    <div className={styles.progressBlock}>
      <div className={styles.progressMeta}>
        <span>{countLabel}</span>
      </div>
      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={Math.max(progress.total, 0)}
        aria-valuenow={progress.achieved}
        aria-label={`${title}の進捗：${countLabel}`}
      >
        <div className={fillClass} style={{ width: `${ratio * 100}%` }} />
      </div>
      <p className={styles.progressHint}>{hint}</p>
    </div>
  );
}

export const ChallengeScreen = () => {
  const { currentUser } = useAuth();
  const { state, activeSpaceMembershipStatus } = useHossiiStore();
  const activeSpace = state.spaces.find((s) => s.id === state.activeSpaceId) ?? null;
  const spaceId = activeSpace?.id ?? null;
  const userId = currentUser?.uid ?? null;
  const membershipStatus = activeSpaceMembershipStatus;

  const [view, setView] = useState<View>({ kind: 'list' });
  const [programs, setPrograms] = useState<ChallengeProgram[]>([]);
  const [listProgressByProgram, setListProgressByProgram] = useState<
    Record<string, ChallengeListProgress>
  >({});
  const [listBoundSpaceId, setListBoundSpaceId] = useState<string | null>(null);
  const [items, setItems] = useState<ChallengeItem[]>([]);
  const [myResponses, setMyResponses] = useState<Record<string, ChallengeResponse>>({});
  const [activeProgram, setActiveProgram] = useState<ChallengeProgram | null>(null);

  const [initialLoading, setInitialLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
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
  const [rewardModal, setRewardModal] = useState<ChallengeRewardModalModel | null>(
    null,
  );
  const [recallModal, setRecallModal] = useState<ChallengeRecallModalModel | null>(
    null,
  );
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  const listRequestIdRef = useRef(0);
  const programsRef = useRef(programs);
  const listBoundSpaceIdRef = useRef(listBoundSpaceId);
  programsRef.current = programs;
  listBoundSpaceIdRef.current = listBoundSpaceId;

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
    Boolean(userId) &&
    Boolean(spaceId) &&
    canFetchChallengeParticipantList(membershipStatus);

  const waitingMembership =
    Boolean(userId) &&
    Boolean(spaceId) &&
    isChallengeListWaitingMembership(membershipStatus);

  const hasVisibleList = listBoundSpaceId === spaceId && programs.length > 0;

  const reloadList = useCallback(async () => {
    if (!spaceId || !userId || !canFetchChallengeParticipantList(membershipStatus)) {
      return;
    }

    const requestId = ++listRequestIdRef.current;
    const isRefresh =
      listBoundSpaceIdRef.current === spaceId && programsRef.current.length > 0;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setInitialLoading(true);
    }
    setLoadError(null);

    try {
      const result = await withChallengeListTimeout(
        (async () => {
          const listed = await listPublishedChallengePrograms(spaceId);
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
          return { listed, progressByProgram };
        })(),
      );

      if (requestId !== listRequestIdRef.current) return;

      setPrograms(result.listed);
      setListProgressByProgram(result.progressByProgram);
      setListBoundSpaceId(spaceId);
      setLoadError(null);
    } catch {
      if (requestId !== listRequestIdRef.current) return;
      setLoadError(LIST_LOAD_ERROR_TITLE);
      if (!isRefresh) {
        setPrograms([]);
        setListProgressByProgram({});
        setListBoundSpaceId(null);
      }
    } finally {
      if (requestId === listRequestIdRef.current) {
        setInitialLoading(false);
        setRefreshing(false);
      }
    }
  }, [spaceId, userId, membershipStatus]);

  // Space / user switch must not keep previous space detail / stamp / list.
  useEffect(() => {
    listRequestIdRef.current += 1;
    setView({ kind: 'list' });
    setActiveProgram(null);
    setItems([]);
    setMyResponses({});
    setMyRewards({});
    setMyCompletions({});
    setDrafts({});
    setFormError(null);
    setRewardModal(null);
    setRecallModal(null);
    setActiveItemId(null);
    setPrograms([]);
    setListProgressByProgram({});
    setListBoundSpaceId(null);
    setLoadError(null);
    setInitialLoading(false);
    setRefreshing(false);
  }, [spaceId, userId]);

  useEffect(() => {
    if (!spaceId || !userId) return;
    if (!canFetchChallengeParticipantList(membershipStatus)) return;

    void reloadList();
    return () => {
      listRequestIdRef.current += 1;
    };
  }, [spaceId, userId, membershipStatus, reloadList]);

  const openDetail = async (programId: string) => {
    if (!spaceId) return;
    setFormError(null);
    setBusyItemId('__open__');
    try {
      const listed = await listPublishedChallengePrograms(spaceId);
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
      setRewardModal(null);
      setRecallModal(null);
      setView({ kind: 'detail', programId });
    } catch {
      setFormError('挑戦状の詳細を読み込めませんでした');
    } finally {
      setBusyItemId(null);
    }
  };

  const returnToList = () => {
    setRewardModal(null);
    setRecallModal(null);
    setActiveItemId(null);
    setView({ kind: 'list' });
    void reloadList();
  };

  const closeRewardModal = (action: 'primary' | 'secondary' | 'dismiss') => {
    const modal = rewardModal;
    setRewardModal(null);
    if (!modal) return;
    if (action === 'secondary') {
      returnToList();
      return;
    }
    if (modal.kind === 'complete') {
      setActiveItemId(null);
      window.requestAnimationFrame(() => {
        document.getElementById('challenge-trajectory-cta')?.focus();
      });
      return;
    }
    setActiveItemId(modal.nextFocusItemId);
    window.requestAnimationFrame(() => {
      document.getElementById('challenge-focus-heading')?.focus();
    });
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
      const nextRewards: Record<string, ChallengeReward> = {
        ...myRewards,
        [item.id]: result.value.reward,
      };
      const nextCompletions: Record<string, ChallengeCompletion> = {
        ...myCompletions,
        [item.id]: result.value.completion,
      };
      setMyResponses(nextResponses);
      setMyRewards(nextRewards);
      setMyCompletions(nextCompletions);
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
        const nextSlots = buildChallengeStampSlots(
          items,
          Object.values(nextCompletions),
          Object.values(nextRewards),
        );
        const nextProgress = getChallengeStampProgress(nextSlots);
        setRewardModal({
          hossiiKey: result.value.reward.hossiiKey,
          itemTitle: item.title,
          kind: resolveChallengeRewardCelebrationKind(
            nextProgress,
            nextFocus != null,
          ),
          progressLabel: formatRewardCelebrationProgressLabel(
            nextProgress,
            items.length,
          ),
          optionalLeftoverLabel: formatOptionalLeftoverLabel(nextProgress),
          nextFocusItemId: nextFocus,
        });
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

  const rewriteResponse = (item: ChallengeItem) => {
    if (busyItemId) return;
    const existing = myResponses[item.id];
    if (!existing) return;
    setFormError(null);
    setDrafts((prev) => ({
      ...prev,
      [item.id]: {
        comment: existing.comment,
        visibility: existing.visibility,
      },
    }));
    setActiveItemId(item.id);
  };

  const deleteResponse = async (item: ChallengeItem) => {
    if (busyItemId) {
      throw new Error('ほかの操作が終わるまでお待ちください');
    }
    const existing = myResponses[item.id];
    if (!existing) {
      throw new Error('削除できる回答が見つかりません');
    }
    setBusyItemId(item.id);
    setFormError(null);
    try {
      const result = await deleteChallengeResponse(existing.id);
      if (!result.ok) {
        throw new Error(toParticipantDeleteError(result.error));
      }
      setMyResponses((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      setDrafts((prev) => ({
        ...prev,
        [item.id]: {
          comment: '',
          visibility: 'manager_only',
        },
      }));
      setActiveItemId((current) => (current === item.id ? null : current));
      showToast('回答を削除しました');
    } finally {
      setBusyItemId(null);
    }
  };

  const openRecallForItem = (itemId: string) => {
    const completion = myCompletions[itemId];
    if (!completion) return;
    const item = items.find((entry) => entry.id === itemId);
    if (!item) return;
    setRecallModal({
      item,
      response: myResponses[itemId] ?? null,
      completion,
      reward: myRewards[itemId] ?? null,
    });
  };

  const openRecallFromSlot = (slot: ChallengeStampSlot) => {
    if (!slot.completion) return;
    setRecallModal({
      item: slot.item,
      response: myResponses[slot.item.id] ?? null,
      completion: slot.completion,
      reward: slot.reward,
    });
  };

  const openPendingFromSlot = (slot: ChallengeStampSlot) => {
    setRecallModal(null);
    setActiveItemId(slot.item.id);
    window.requestAnimationFrame(() => {
      document.getElementById(`challenge-item-panel-${slot.item.id}`)?.scrollIntoView({
        block: 'nearest',
      });
    });
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

  if (isChallengeListAccessDenied(membershipStatus)) {
    return (
      <div className={styles.container}>
        <ListIntro />
        <p className={styles.muted}>このスペースの参加者のみ挑戦状に回答できます。</p>
      </div>
    );
  }

  if (view.kind === 'trajectory' && activeProgram) {
    return (
      <div className={styles.container}>
        <ChallengeTrajectoryView
          program={activeProgram}
          slots={stampSlots}
          responsesByItemId={myResponses}
          onBack={() => {
            setView({ kind: 'detail', programId: activeProgram.id });
          }}
        />
        {toast && (
          <div className={styles.toast} aria-live="polite">
            {toast}
          </div>
        )}
      </div>
    );
  }

  if (view.kind === 'detail' && activeProgram) {
    const focusItem = focusItemId
      ? sortedItems.find((item) => item.id === focusItemId) ?? null
      : null;
    const heroItem =
      (activeItemId
        ? sortedItems.find((item) => item.id === activeItemId) ?? null
        : null) ?? focusItem;
    const heroIsRewrite = Boolean(
      heroItem && myResponses[heroItem.id] && activeItemId === heroItem.id,
    );
    const stampProgress = getChallengeStampProgress(stampSlots);
    const recordRows: ChallengeRecordRow[] = sortedItems
      .filter(
        (item) =>
          Boolean(myResponses[item.id]) || Boolean(myCompletions[item.id]),
      )
      .map((item) => {
        const response = myResponses[item.id] ?? null;
        const completion = myCompletions[item.id] ?? null;
        const date =
          completion?.completedAt ??
          response?.updatedAt ??
          response?.createdAt ??
          null;
        return { item, response, completion, date };
      })
      .sort((a, b) => {
        const aTime = a.date?.getTime() ?? 0;
        const bTime = b.date?.getTime() ?? 0;
        if (aTime !== bTime) return aTime - bTime;
        return compareChallengeItems(a.item, b.item);
      });

    const openTrajectory = () => {
      setRecallModal(null);
      setRewardModal(null);
      setView({ kind: 'trajectory', programId: activeProgram.id });
    };
    const collectedLabel = formatCollectedHossiiLabel(stampSlots);

    const renderHeroCard = (item: ChallengeItem) => {
      const draft = drafts[item.id] ?? {
        comment: '',
        visibility: 'manager_only' as const,
      };
      const hasResponse = Boolean(myResponses[item.id]);
      const stampEarned =
        !hasResponse &&
        (Boolean(myCompletions[item.id]) || Boolean(myRewards[item.id]));
      return (
        <ChallengeItemCard
          key={item.id}
          item={item}
          index={sortedItems.findIndex((entry) => entry.id === item.id) + 1}
          existing={myResponses[item.id]}
          draft={draft}
          saving={busyItemId === item.id}
          expanded={activeItemId === item.id || !hasResponse}
          emphasized
          panelId={`challenge-item-panel-${item.id}`}
          stampEarned={stampEarned}
          showManageActions={false}
          onExpand={() => setActiveItemId(item.id)}
          onCollapse={() => setActiveItemId(focusItemId)}
          onDraftChange={(next) =>
            setDrafts((prev) => ({ ...prev, [item.id]: next }))
          }
          onSave={() => void saveResponse(item)}
        />
      );
    };

    const heroHeading = heroIsRewrite
      ? '回答を書き直す'
      : focusSectionKind === 'optional'
        ? 'おまけの挑戦'
        : '次の挑戦';
    const heroLead = heroIsRewrite
      ? '記録をそっと更新しよう'
      : focusSectionKind === 'optional'
        ? 'もっとHossiiを集めたい人へ'
        : 'まずはこの質問に答えてみよう';

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
                setRewardModal(null);
                setRecallModal(null);
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

        {stampProgress.isComplete ? (
          <section
            className={styles.clearBanner}
            aria-label="挑戦状のクリア状態"
          >
            <div className={styles.clearBannerText}>
              <span className={styles.clearAccent}>クリア</span>
              <span className={styles.clearBannerMeta}>
                {focusItem
                  ? '必須クリア · 軌跡ができあがっています'
                  : '軌跡がそろいました'}
                {collectedLabel ? ` · ${collectedLabel}` : ''}
              </span>
            </div>
            <button
              id="challenge-trajectory-cta"
              type="button"
              className={styles.trajectoryPrimary}
              onClick={openTrajectory}
            >
              完成した軌跡を見る
            </button>
          </section>
        ) : (
          <ChallengeProgressSummary slots={stampSlots} />
        )}

        {sortedItems.length === 0 ? (
          <div className={styles.detailEmpty}>
            この挑戦状には、まだ質問がありません
          </div>
        ) : (
          <>
            {heroItem ? (
              <section
                className={`${styles.focusSection} ${styles.focusHero}`}
                aria-labelledby="challenge-focus-heading"
              >
                <h2
                  id="challenge-focus-heading"
                  className={styles.focusHeading}
                  tabIndex={-1}
                >
                  {heroHeading}
                </h2>
                <p className={styles.focusLead}>{heroLead}</p>
                <ul className={styles.itemList}>{renderHeroCard(heroItem)}</ul>
              </section>
            ) : null}

            <ChallengeStampCard
              key={activeProgram.id}
              slots={stampSlots}
              onSelectAchieved={openRecallFromSlot}
              onSelectPending={openPendingFromSlot}
            />

            <ChallengeRecordsSection
              records={recordRows}
              onOpenRecord={(itemId) => openRecallForItem(itemId)}
            />

            {!stampProgress.isComplete ? (
              <button
                type="button"
                className={styles.trajectoryLink}
                onClick={openTrajectory}
              >
                わたしの軌跡を見る
              </button>
            ) : null}
          </>
        )}

        {toast && (
          <div className={styles.toast} aria-live="polite">
            {toast}
          </div>
        )}
        {rewardModal && (
          <ChallengeRewardModal
            model={rewardModal}
            onPrimary={() => closeRewardModal('primary')}
            onSecondary={() => closeRewardModal('secondary')}
            onDismiss={() => closeRewardModal('dismiss')}
          />
        )}
        {recallModal && (
          <ChallengeRecallModal
            model={recallModal}
            onRewrite={() => {
              const item = recallModal.item;
              setRecallModal(null);
              rewriteResponse(item);
            }}
            onAnswerAgain={() => {
              const itemId = recallModal.item.id;
              setRecallModal(null);
              setActiveItemId(itemId);
            }}
            onDelete={
              recallModal.response
                ? () => deleteResponse(recallModal.item)
                : undefined
            }
            onDismiss={() => setRecallModal(null)}
          />
        )}
      </div>
    );
  }

  const showInitialLoading =
    canFetchChallengeParticipantList(membershipStatus) &&
    initialLoading &&
    !hasVisibleList;
  const showWaitingMembership = waitingMembership && !hasVisibleList;
  const showListError =
    Boolean(loadError) &&
    !showInitialLoading &&
    !showWaitingMembership &&
    !hasVisibleList;
  const showEmpty =
    canFetchChallengeParticipantList(membershipStatus) &&
    !initialLoading &&
    !refreshing &&
    !loadError &&
    !hasVisibleList &&
    listBoundSpaceId === spaceId;
  const showProgramList = hasVisibleList;

  return (
    <div className={styles.container}>
      <ListIntro />

      {(showInitialLoading || showWaitingMembership) && (
        <div className={styles.listLoading} aria-busy="true" aria-live="polite">
          <p className={styles.muted}>
            {showWaitingMembership
              ? '挑戦状を準備しています…'
              : '挑戦状をひろっています…'}
          </p>
          <div className={styles.skeletonCard} />
          <div className={styles.skeletonCard} />
        </div>
      )}

      {showProgramList && (
        <>
          {refreshing ? (
            <p className={styles.refreshHint} aria-live="polite">
              最新の挑戦状を確認しています…
            </p>
          ) : null}
          {loadError ? (
            <div className={styles.listErrorInline} role="alert">
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
          ) : null}
          <ul className={styles.programList}>
            {programs.map((program) => {
              const progress =
                listProgressByProgram[program.id] ??
                getChallengeListProgress([], []);
              const ctaLabel = getChallengeListCtaLabel();
              const openLabel = getChallengeListOpenLabel(program.title);
              const statusLabel = getChallengeListStatusLabel(
                progress.listStatus,
                progress.total,
              );
              const statusClass =
                progress.total <= 0
                  ? styles.statusBadgePreparing
                  : progress.listStatus === 'completed'
                    ? styles.statusBadgeCompleted
                    : progress.listStatus === 'cleared'
                      ? styles.statusBadgeCleared
                      : progress.listStatus === 'in_progress'
                        ? styles.statusBadgeInProgress
                        : styles.statusBadgeNotStarted;
              return (
                <li key={program.id} className={styles.programCard}>
                  <span className={`${styles.statusBadge} ${statusClass}`}>
                    {statusLabel}
                  </span>
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
                      aria-label={openLabel}
                      onClick={() => void openDetail(program.id)}
                    >
                      {ctaLabel}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {showListError && (
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

      {showEmpty && (
        <div className={styles.emptyState}>
          <img className={styles.emptyDecor} src={LIST_DECOR_HOSSII} alt="" />
          <p className={styles.emptyTitle}>いま挑戦できる挑戦状はありません</p>
          <p className={styles.muted}>
            新しい挑戦状が届くまで、少し待っていてね
          </p>
        </div>
      )}

      {formError && <p className={styles.error}>{formError}</p>}
      {toast && <div className={styles.toast} aria-live="polite">{toast}</div>}
    </div>
  );
};
