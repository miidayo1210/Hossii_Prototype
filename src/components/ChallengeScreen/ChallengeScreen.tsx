import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../core/contexts/useAuth';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import type { ChallengeItem, ChallengeProgram } from '../../core/types/challengeProgram';
import type {
  ChallengeResponse,
  ChallengeResponseVisibility,
} from '../../core/types/challengeResponse';
import { CHALLENGE_RESPONSE_COMMENT_MAX_LENGTH } from '../../core/types/challengeResponse';
import {
  createChallengeResponse,
  getMyChallengeResponse,
  listMyChallengeResponses,
  listPublishedChallengeItems,
  listPublishedChallengePrograms,
  updateChallengeResponse,
} from '../../core/utils/challengeResponsesApi';
import { TopRightMenu } from '../Navigation/TopRightMenu';
import styles from './ChallengeScreen.module.css';

type View =
  | { kind: 'list' }
  | { kind: 'detail'; programId: string };

function visibilityHelp(visibility: ChallengeResponseVisibility): string {
  if (visibility === 'self_only') {
    return 'この回答は、あなただけが見ることができます。';
  }
  return 'この回答は、あなたとスペース管理者だけが見ることができます。';
}

function visibilityLabel(visibility: ChallengeResponseVisibility): string {
  return visibility === 'self_only' ? '自分だけ' : '管理者だけ';
}

export const ChallengeScreen = () => {
  const { currentUser } = useAuth();
  const { state, activeSpaceMembershipStatus } = useHossiiStore();
  const activeSpace = state.spaces.find((s) => s.id === state.activeSpaceId) ?? null;

  const [view, setView] = useState<View>({ kind: 'list' });
  const [programs, setPrograms] = useState<ChallengeProgram[]>([]);
  const [answeredCounts, setAnsweredCounts] = useState<Record<string, number>>({});
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});
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
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const listed = await listPublishedChallengePrograms(activeSpace.id);
      setPrograms(listed);
      const counts: Record<string, number> = {};
      const answered: Record<string, number> = {};
      await Promise.all(
        listed.map(async (program) => {
          const programItems = await listPublishedChallengeItems(program.id);
          counts[program.id] = programItems.length;
          const mine = await listMyChallengeResponses(programItems.map((i) => i.id));
          answered[program.id] = mine.length;
        }),
      );
      setItemCounts(counts);
      setAnsweredCounts(answered);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '読み込みに失敗しました');
      setPrograms([]);
    } finally {
      setLoading(false);
    }
  }, [activeSpace, currentUser?.uid]);

  useEffect(() => {
    void reloadList();
  }, [reloadList]);

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
      const mine = await listMyChallengeResponses(programItems.map((i) => i.id));
      const byItem: Record<string, ChallengeResponse> = {};
      const nextDrafts: Record<
        string,
        { comment: string; visibility: ChallengeResponseVisibility }
      > = {};
      for (const item of programItems) {
        const existing = mine.find((r) => r.itemId === item.id);
        if (existing) byItem[item.id] = existing;
        nextDrafts[item.id] = {
          comment: existing?.comment ?? '',
          visibility: existing?.visibility ?? 'manager_only',
        };
      }
      setActiveProgram(program);
      setItems(programItems);
      setMyResponses(byItem);
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
    setBusyItemId(item.id);
    setFormError(null);
    try {
      const existing =
        myResponses[item.id] ?? (await getMyChallengeResponse(item.id));
      const result = existing
        ? await updateChallengeResponse(existing.id, {
            comment: draft.comment,
            visibility: draft.visibility,
          })
        : await createChallengeResponse({
            itemId: item.id,
            comment: draft.comment,
            visibility: draft.visibility,
          });
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      setMyResponses((prev) => ({ ...prev, [item.id]: result.value }));
      setDrafts((prev) => ({
        ...prev,
        [item.id]: {
          comment: result.value.comment,
          visibility: result.value.visibility,
        },
      }));
      showToast(existing ? '回答を更新しました' : '回答を保存しました');
    } finally {
      setBusyItemId(null);
    }
  };

  if (!currentUser?.uid) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>学びを深める、Hossiiからの挑戦状！</h1>
          </div>
          <TopRightMenu />
        </div>
        <p className={styles.muted}>ログインしたスペース参加者のみ利用できます。</p>
      </div>
    );
  }

  if (!activeSpace) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>学びを深める、Hossiiからの挑戦状！</h1>
          </div>
          <TopRightMenu />
        </div>
        <p className={styles.muted}>スペースを選択してください。</p>
      </div>
    );
  }

  if (activeSpaceMembershipStatus === 'none' || activeSpaceMembershipStatus === 'error') {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>学びを深める、Hossiiからの挑戦状！</h1>
          </div>
          <TopRightMenu />
        </div>
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

        <ul className={styles.itemList}>
          {items.map((item) => {
            const draft = drafts[item.id] ?? {
              comment: '',
              visibility: 'manager_only' as const,
            };
            const existing = myResponses[item.id];
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
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>学びを深める、Hossiiからの挑戦状！</h1>
          <p className={styles.subtitle}>
            公開中の質問・ミッションにコメントで答えられます。
          </p>
        </div>
        <TopRightMenu />
      </div>

      {/* MVP暫定: 全体ON/OFF未実装。ナビも published program の SELECT 可否から導出する。 */}
      <p className={styles.mvpNote}>
        ※挑戦状機能の全体ON/OFFは未実装です。公開中ストーリーがあるときだけナビに表示されます。
      </p>

      {loading && <p className={styles.muted}>読み込み中…</p>}
      {loadError && <p className={styles.error}>{loadError}</p>}
      {!loading && !loadError && programs.length === 0 && (
        <div className={styles.empty}>
          いま公開中の挑戦状はありません。
        </div>
      )}

      <ul className={styles.programList}>
        {programs.map((program) => {
          const total = itemCounts[program.id] ?? 0;
          const answered = answeredCounts[program.id] ?? 0;
          const started = answered > 0;
          return (
            <li key={program.id} className={styles.card}>
              <div className={styles.meta}>
                <span className={styles.badge}>公開中</span>
                <span>
                  回答済み {answered} / {total}
                </span>
              </div>
              <strong>{program.title}</strong>
              {program.description && (
                <p className={styles.muted}>{program.description}</p>
              )}
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.primaryButton}
                  disabled={!canAccess || busyItemId != null}
                  onClick={() => void openDetail(program.id)}
                >
                  {started ? 'つづける' : '挑戦する'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {formError && <p className={styles.error}>{formError}</p>}
      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  );
};
