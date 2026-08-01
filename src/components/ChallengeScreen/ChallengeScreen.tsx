import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../core/contexts/useAuth';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import type { ChallengeItem, ChallengeProgram } from '../../core/types/challengeProgram';
import type {
  ChallengeResponse,
  ChallengeResponseVisibility,
} from '../../core/types/challengeResponse';
import { CHALLENGE_RESPONSE_COMMENT_MAX_LENGTH } from '../../core/types/challengeResponse';
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
  getChallengeListCtaLabel,
  getChallengeListProgress,
  type ChallengeListProgress,
} from '../../core/utils/challengeStampProgress';
import { TopRightMenu } from '../Navigation/TopRightMenu';
import { ChallengeStampCard } from './ChallengeStampCard';
import styles from './ChallengeScreen.module.css';

type View =
  | { kind: 'list' }
  | { kind: 'detail'; programId: string };

const LIST_LOAD_ERROR_TITLE = '挑戦状を読み込めませんでした';
const LIST_LOAD_ERROR_HINT = '時間をおいて、もう一度試してください';
const LIST_DECOR_HOSSII = getChallengeHossiiImageUrl('emotion/kirakira');

function visibilityHelp(visibility: ChallengeResponseVisibility): string {
  if (visibility === 'self_only') {
    return 'この回答は、あなただけが見ることができます。';
  }
  return 'この回答は、あなたとスペース管理者だけが見ることができます。';
}

function visibilityLabel(visibility: ChallengeResponseVisibility): string {
  return visibility === 'self_only' ? '自分だけ' : '管理者だけ';
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

  const stampSlots = useMemo(
    () =>
      buildChallengeStampSlots(
        items,
        Object.values(myCompletions),
        Object.values(myRewards),
      ),
    [items, myCompletions, myRewards],
  );

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
      setView({ kind: 'detail', programId });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '読み込みに失敗しました');
    } finally {
      setBusyItemId(null);
    }
  };

  const saveResponse = async (item: ChallengeItem) => {
    if (busyItemId) return;
    const draft = drafts[item.id] ?? {
      comment: '',
      visibility: 'manager_only' as const,
    };
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
        setFormError(result.error);
        return;
      }
      setMyResponses((prev) => ({
        ...prev,
        [item.id]: {
          id: result.value.response.id,
          itemId: result.value.response.itemId,
          userId: result.value.response.userId,
          visibility: result.value.response.visibility,
          comment: result.value.response.comment,
          createdAt: result.value.response.createdAt,
          updatedAt: result.value.response.updatedAt,
        },
      }));
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
      if (result.value.isNewReward) {
        setRewardModal(result.value.reward);
      } else {
        showToast(hadResponse ? '回答を更新しました' : '回答を保存しました');
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
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.titleBlock}>
            <button
              type="button"
              className={styles.backButton}
              onClick={() => {
                setView({ kind: 'list' });
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

        {formError && <p className={styles.error}>{formError}</p>}

        <ChallengeStampCard slots={stampSlots} />

        <ul className={styles.itemList}>
          {items.map((item) => {
            const draft = drafts[item.id] ?? {
              comment: '',
              visibility: 'manager_only' as const,
            };
            const existing = myResponses[item.id];
            const achieved = Boolean(myCompletions[item.id]);
            const saving = busyItemId === item.id;
            return (
              <li key={item.id} className={styles.card}>
                <div className={styles.meta}>
                  <span className={styles.badge}>
                    {item.itemType === 'question' ? '質問' : 'ミッション'}
                  </span>
                  <span className={styles.badge}>
                    {item.isRequired ? '必須' : 'おまけ'}
                  </span>
                  <span className={styles.badge}>
                    {existing ? '回答済み' : '未回答'}
                  </span>
                  <span className={styles.badge}>
                    {achieved ? 'スタンプ獲得済' : 'スタンプ未獲得'}
                  </span>
                </div>
                <strong>{item.title}</strong>
                {item.description && <p className={styles.muted}>{item.description}</p>}
                {item.reason && (
                  <p className={styles.muted}>なぜ取り組むのか：{item.reason}</p>
                )}
                {existing && (
                  <p className={styles.existingAnswer}>
                    保存済み（{visibilityLabel(existing.visibility)}）
                    {'\n'}
                    {existing.comment}
                  </p>
                )}
                {!existing && myRewards[item.id] && (
                  <p className={styles.muted}>
                    この項目のHossiiは取得済みです（回答は未保存の状態でも報酬は保持されます）。
                  </p>
                )}
                <div className={styles.itemForm}>
                  <label className={styles.label}>
                    コメント回答
                    <textarea
                      className={styles.textarea}
                      rows={4}
                      maxLength={CHALLENGE_RESPONSE_COMMENT_MAX_LENGTH}
                      value={draft.comment}
                      disabled={saving}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [item.id]: { ...draft, comment: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className={styles.label}>
                    公開範囲
                    <select
                      className={styles.select}
                      value={draft.visibility}
                      disabled={saving}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [item.id]: {
                            ...draft,
                            visibility: e.target.value as ChallengeResponseVisibility,
                          },
                        }))
                      }
                    >
                      <option value="manager_only">管理者だけ</option>
                      <option value="self_only">自分だけ</option>
                    </select>
                  </label>
                  <p className={styles.visibilityHelp}>
                    {visibilityHelp(draft.visibility)}
                  </p>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      disabled={saving || !draft.comment.trim()}
                      onClick={() => void saveResponse(item)}
                    >
                      {saving ? '保存中…' : existing ? '回答を更新' : '回答を保存'}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {toast && <div className={styles.toast}>{toast}</div>}
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
                  onClick={() => setRewardModal(null)}
                >
                  閉じる
                </button>
                <button
                  type="button"
                  className={styles.ghostButton}
                  onClick={() => {
                    setRewardModal(null);
                    setView({ kind: 'list' });
                    void reloadList();
                  }}
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
