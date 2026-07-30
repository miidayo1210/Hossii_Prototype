import { useCallback, useEffect, useState } from 'react';
import type { Space } from '../../core/types/space';
import type {
  ChallengeItem,
  ChallengeItemType,
  ChallengeProgram,
} from '../../core/types/challengeProgram';
import { CHALLENGE_TITLE_MAX_LENGTH } from '../../core/types/challengeProgram';
import { useAuth } from '../../core/contexts/useAuth';
import { canManageSpace } from '../../core/utils/spaceAdminAccess';
import {
  createChallengeItem,
  createChallengeProgram,
  deleteChallengeItem,
  deleteChallengeProgram,
  listChallengeItems,
  listChallengePrograms,
  updateChallengeItem,
  updateChallengeProgram,
  updateChallengeProgramStatus,
} from '../../core/utils/challengeProgramsApi';
import { listManagerChallengeResponses } from '../../core/utils/challengeResponsesApi';
import type { ChallengeResponse } from '../../core/types/challengeResponse';
import { SettingsPageHeader } from './SettingsPageHeader';
import { SettingsSection } from './SettingsSection';
import sharedStyles from './SettingsShared.module.css';
import formStyles from './GeneralTab.module.css';
import styles from './ChallengeAdminTab.module.css';

type Props = {
  space: Space;
};

type View =
  | { kind: 'list' }
  | { kind: 'create' }
  | { kind: 'edit'; programId: string };

type ItemFormState = {
  itemType: ChallengeItemType;
  title: string;
  description: string;
  reason: string;
  isRequired: boolean;
};

const EMPTY_ITEM_FORM: ItemFormState = {
  itemType: 'question',
  title: '',
  description: '',
  reason: '',
  isRequired: true,
};

function formatUpdatedAt(value: Date): string {
  try {
    return value.toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value.toISOString();
  }
}

function statusLabel(status: ChallengeProgram['status']): string {
  switch (status) {
    case 'draft':
      return '下書き';
    case 'published':
      return '公開中';
    case 'ended':
      return '終了';
    case 'archived':
      return 'アーカイブ';
    default:
      return status;
  }
}

export const ChallengeAdminTab = ({ space }: Props) => {
  const { currentUser } = useAuth();
  const canManage = canManageSpace(currentUser, space);

  const [view, setView] = useState<View>({ kind: 'list' });
  const [programs, setPrograms] = useState<ChallengeProgram[]>([]);
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});
  const [items, setItems] = useState<ChallengeItem[]>([]);
  const [editingProgram, setEditingProgram] = useState<ChallengeProgram | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [programTitle, setProgramTitle] = useState('');
  const [programDescription, setProgramDescription] = useState('');
  const [itemForm, setItemForm] = useState<ItemFormState>(EMPTY_ITEM_FORM);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [showItemForm, setShowItemForm] = useState(false);
  const [responsesItemId, setResponsesItemId] = useState<string | null>(null);
  const [managerResponses, setManagerResponses] = useState<ChallengeResponse[]>([]);
  const [responsesLoading, setResponsesLoading] = useState(false);
  const [responsesError, setResponsesError] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3000);
  }, []);

  const reloadPrograms = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const listed = await listChallengePrograms(space.id);
      setPrograms(listed);
      const counts: Record<string, number> = {};
      await Promise.all(
        listed.map(async (program) => {
          const programItems = await listChallengeItems(program.id);
          counts[program.id] = programItems.length;
        }),
      );
      setItemCounts(counts);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '読み込みに失敗しました');
      setPrograms([]);
      setItemCounts({});
    } finally {
      setLoading(false);
    }
  }, [space.id]);

  useEffect(() => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    void reloadPrograms();
  }, [canManage, reloadPrograms]);

  const openCreate = () => {
    setProgramTitle('');
    setProgramDescription('');
    setFormError(null);
    setView({ kind: 'create' });
  };

  const openEdit = async (programId: string) => {
    setFormError(null);
    setBusy(true);
    try {
      const listed = await listChallengePrograms(space.id);
      const program = listed.find((p) => p.id === programId) ?? null;
      if (!program) {
        setFormError('ストーリーが見つかりません');
        return;
      }
      const programItems = await listChallengeItems(programId);
      setEditingProgram(program);
      setProgramTitle(program.title);
      setProgramDescription(program.description ?? '');
      setItems(programItems);
      setEditingItemId(null);
      setShowItemForm(false);
      setItemForm(EMPTY_ITEM_FORM);
      setView({ kind: 'edit', programId });
    } finally {
      setBusy(false);
    }
  };

  const backToList = async () => {
    setView({ kind: 'list' });
    setEditingProgram(null);
    setItems([]);
    setFormError(null);
    await reloadPrograms();
  };

  const handleCreateProgram = async () => {
    if (busy) return;
    setBusy(true);
    setFormError(null);
    const result = await createChallengeProgram({
      spaceId: space.id,
      title: programTitle,
      description: programDescription,
    });
    setBusy(false);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    showToast('下書きストーリーを作成しました');
    await openEdit(result.value.id);
  };

  const handleSaveProgram = async () => {
    if (!editingProgram || busy) return;
    if (editingProgram.status !== 'draft') {
      setFormError('下書き以外のストーリーは編集できません');
      return;
    }
    setBusy(true);
    setFormError(null);
    const result = await updateChallengeProgram(editingProgram.id, {
      title: programTitle,
      description: programDescription,
    });
    setBusy(false);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    setEditingProgram(result.value);
    showToast('ストーリーを保存しました');
  };

  const handleDeleteProgram = async (program: ChallengeProgram) => {
    if (busy) return;
    if (program.status !== 'draft') {
      window.alert('下書き以外のストーリーは削除できません');
      return;
    }
    const ok = window.confirm(
      `「${program.title}」を削除しますか？\n項目もまとめて削除されます。この操作は取り消せません。`,
    );
    if (!ok) return;
    setBusy(true);
    const result = await deleteChallengeProgram(program.id);
    setBusy(false);
    if (!result.ok) {
      setFormError(result.error);
      showToast(result.error);
      return;
    }
    showToast('ストーリーを削除しました');
    if (view.kind === 'edit' && view.programId === program.id) {
      await backToList();
    } else {
      await reloadPrograms();
    }
  };

  const startAddItem = (itemType: ChallengeItemType) => {
    setEditingItemId(null);
    setItemForm({ ...EMPTY_ITEM_FORM, itemType });
    setShowItemForm(true);
    setFormError(null);
  };

  const startEditItem = (item: ChallengeItem) => {
    setEditingItemId(item.id);
    setItemForm({
      itemType: item.itemType,
      title: item.title,
      description: item.description ?? '',
      reason: item.reason ?? '',
      isRequired: item.isRequired,
    });
    setShowItemForm(true);
    setFormError(null);
  };

  const handleSaveItem = async () => {
    if (!editingProgram || busy) return;
    if (editingProgram.status !== 'draft') {
      setFormError('下書き以外では項目を変更できません');
      return;
    }
    setBusy(true);
    setFormError(null);

    if (editingItemId) {
      const result = await updateChallengeItem(editingItemId, {
        itemType: itemForm.itemType,
        title: itemForm.title,
        description: itemForm.description,
        reason: itemForm.reason,
        isRequired: itemForm.isRequired,
        responseType: 'comment',
      });
      setBusy(false);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      showToast('項目を更新しました');
    } else {
      const nextSort =
        items.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1;
      const result = await createChallengeItem({
        programId: editingProgram.id,
        itemType: itemForm.itemType,
        title: itemForm.title,
        description: itemForm.description,
        reason: itemForm.reason,
        isRequired: itemForm.isRequired,
        responseType: 'comment',
        sortOrder: nextSort,
      });
      setBusy(false);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      showToast('項目を追加しました');
    }

    const refreshed = await listChallengeItems(editingProgram.id);
    setItems(refreshed);
    setShowItemForm(false);
    setEditingItemId(null);
    setItemForm(EMPTY_ITEM_FORM);
  };

  const handleDeleteItem = async (item: ChallengeItem) => {
    if (busy || !editingProgram) return;
    if (editingProgram.status !== 'draft') {
      window.alert('下書き以外では項目を削除できません');
      return;
    }
    const ok = window.confirm(`「${item.title}」を削除しますか？`);
    if (!ok) return;
    setBusy(true);
    const result = await deleteChallengeItem(item.id);
    setBusy(false);
    if (!result.ok) {
      setFormError(result.error);
      showToast(result.error);
      return;
    }
    showToast('項目を削除しました');
    setItems(await listChallengeItems(editingProgram.id));
  };

  const handlePublish = async () => {
    if (!editingProgram || busy) return;
    if (editingProgram.status !== 'draft') return;
    if (!programTitle.trim()) {
      setFormError('タイトルを入力してください');
      return;
    }
    const commentItems = items.filter((item) => item.responseType === 'comment');
    if (commentItems.length === 0) {
      setFormError('公開するにはコメント形式の項目が1件以上必要です');
      return;
    }
    const ok = window.confirm(
      `「${programTitle.trim()}」を公開しますか？\n公開後は項目の追加・編集・削除ができなくなります。`,
    );
    if (!ok) return;
    setBusy(true);
    setFormError(null);
    if (
      programTitle !== editingProgram.title ||
      programDescription !== (editingProgram.description ?? '')
    ) {
      const saved = await updateChallengeProgram(editingProgram.id, {
        title: programTitle,
        description: programDescription,
      });
      if (!saved.ok) {
        setBusy(false);
        setFormError(saved.error);
        return;
      }
    }
    const result = await updateChallengeProgramStatus(editingProgram.id, 'published');
    setBusy(false);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    setEditingProgram(result.value);
    showToast('挑戦状を公開しました');
  };

  const openManagerResponses = async (itemId: string) => {
    setResponsesItemId(itemId);
    setResponsesLoading(true);
    setResponsesError(null);
    try {
      // RLS: manager_only only. Do not infer self_only existence from empty list.
      const listed = await listManagerChallengeResponses(itemId);
      setManagerResponses(listed);
    } catch (error) {
      setManagerResponses([]);
      setResponsesError(error instanceof Error ? error.message : '回答の取得に失敗しました');
    } finally {
      setResponsesLoading(false);
    }
  };

  if (!canManage) {
    return (
      <SettingsPageHeader
        title="質問・ミッション管理"
        description="このスペースの挑戦状を管理する権限がありません。"
      >
        <p className={styles.muted}>スペース管理者のみが利用できます。</p>
      </SettingsPageHeader>
    );
  }

  if (view.kind === 'create') {
    return (
      <>
        <SettingsPageHeader
          title="新しい挑戦状"
          description="下書きとして作成します。公開や参加者表示はまだできません。"
        >
          <SettingsSection title="基本情報">
            <label className={formStyles.label}>
              タイトル（必須）
              <input
                className={formStyles.nameInput}
                value={programTitle}
                maxLength={CHALLENGE_TITLE_MAX_LENGTH}
                onChange={(e) => setProgramTitle(e.target.value)}
                disabled={busy}
              />
            </label>
            <label className={formStyles.label}>
              説明（任意）
              <textarea
                className={formStyles.textarea}
                value={programDescription}
                rows={4}
                onChange={(e) => setProgramDescription(e.target.value)}
                disabled={busy}
              />
            </label>
            {formError && <p className={styles.error}>{formError}</p>}
            <div className={styles.actions}>
              <button
                type="button"
                className={sharedStyles.ghostButton}
                onClick={() => void backToList()}
                disabled={busy}
              >
                キャンセル
              </button>
              <button
                type="button"
                className={sharedStyles.primaryButton}
                onClick={() => void handleCreateProgram()}
                disabled={busy || !programTitle.trim()}
              >
                {busy ? '作成中…' : '下書きを作成'}
              </button>
            </div>
          </SettingsSection>
        </SettingsPageHeader>
        {toast && (
          <div className={`${sharedStyles.toast} ${sharedStyles.toastSuccess}`}>{toast}</div>
        )}
      </>
    );
  }

  if (view.kind === 'edit' && editingProgram) {
    const isDraft = editingProgram.status === 'draft';
    return (
      <>
        <SettingsPageHeader
          title={editingProgram.title}
          description={
            isDraft
              ? '下書きの編集です。回答形式はコメント固定です。'
              : '公開中のストーリーです。項目構造は変更できません。'
          }
        >
          <div className={styles.actions}>
            <button
              type="button"
              className={sharedStyles.ghostButton}
              onClick={() => void backToList()}
              disabled={busy}
            >
              ← 一覧へ戻る
            </button>
            <span className={styles.badge}>{statusLabel(editingProgram.status)}</span>
          </div>

          <SettingsSection title="ストーリー">
            {!isDraft && (
              <p className={styles.warning}>
                このストーリーは下書きではないため、内容の変更・削除はできません。
              </p>
            )}
            <label className={formStyles.label}>
              タイトル（必須）
              <input
                className={formStyles.nameInput}
                value={programTitle}
                maxLength={CHALLENGE_TITLE_MAX_LENGTH}
                onChange={(e) => setProgramTitle(e.target.value)}
                disabled={busy || !isDraft}
              />
            </label>
            <label className={formStyles.label}>
              説明（任意）
              <textarea
                className={formStyles.textarea}
                value={programDescription}
                rows={4}
                onChange={(e) => setProgramDescription(e.target.value)}
                disabled={busy || !isDraft}
              />
            </label>
            {isDraft && (
              <div className={styles.actions}>
                <button
                  type="button"
                  className={sharedStyles.primaryButton}
                  onClick={() => void handleSaveProgram()}
                  disabled={busy || !programTitle.trim()}
                >
                  {busy ? '保存中…' : 'ストーリーを保存'}
                </button>
                <button
                  type="button"
                  className={sharedStyles.primaryButton}
                  onClick={() => void handlePublish()}
                  disabled={
                    busy ||
                    !programTitle.trim() ||
                    items.filter((item) => item.responseType === 'comment').length === 0
                  }
                >
                  {busy ? '公開中…' : '公開する'}
                </button>
                <button
                  type="button"
                  className={sharedStyles.ghostButton}
                  onClick={() => void handleDeleteProgram(editingProgram)}
                  disabled={busy}
                >
                  下書きを削除
                </button>
              </div>
            )}
          </SettingsSection>

          <SettingsSection title="質問・ミッション">
            <p className={styles.muted}>回答形式：コメント（固定）</p>
            {isDraft && (
              <div className={styles.actions}>
                <button
                  type="button"
                  className={sharedStyles.primaryButton}
                  onClick={() => startAddItem('question')}
                  disabled={busy}
                >
                  質問を追加
                </button>
                <button
                  type="button"
                  className={sharedStyles.ghostButton}
                  onClick={() => startAddItem('mission')}
                  disabled={busy}
                >
                  ミッションを追加
                </button>
              </div>
            )}

            {showItemForm && isDraft && (
              <div className={styles.itemForm}>
                <p className={styles.itemFormTitle}>
                  {editingItemId ? '項目を編集' : '項目を追加'}
                </p>
                <label className={formStyles.label}>
                  種別
                  <select
                    className={formStyles.nameInput}
                    value={itemForm.itemType}
                    onChange={(e) =>
                      setItemForm((prev) => ({
                        ...prev,
                        itemType: e.target.value as ChallengeItemType,
                      }))
                    }
                    disabled={busy}
                  >
                    <option value="question">質問</option>
                    <option value="mission">ミッション</option>
                  </select>
                </label>
                <label className={formStyles.label}>
                  タイトル（必須）
                  <input
                    className={formStyles.nameInput}
                    value={itemForm.title}
                    maxLength={CHALLENGE_TITLE_MAX_LENGTH}
                    onChange={(e) =>
                      setItemForm((prev) => ({ ...prev, title: e.target.value }))
                    }
                    disabled={busy}
                  />
                </label>
                <label className={formStyles.label}>
                  説明（任意）
                  <textarea
                    className={formStyles.textarea}
                    value={itemForm.description}
                    rows={3}
                    onChange={(e) =>
                      setItemForm((prev) => ({ ...prev, description: e.target.value }))
                    }
                    disabled={busy}
                  />
                </label>
                <label className={formStyles.label}>
                  なぜ取り組むのか（任意）
                  <textarea
                    className={formStyles.textarea}
                    value={itemForm.reason}
                    rows={2}
                    onChange={(e) =>
                      setItemForm((prev) => ({ ...prev, reason: e.target.value }))
                    }
                    disabled={busy}
                  />
                </label>
                <label className={styles.checkLabel}>
                  <input
                    type="checkbox"
                    checked={itemForm.isRequired}
                    onChange={(e) =>
                      setItemForm((prev) => ({ ...prev, isRequired: e.target.checked }))
                    }
                    disabled={busy}
                  />
                  必須項目（オフにするとおまけ）
                </label>
                <p className={styles.muted}>回答形式：コメント</p>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={sharedStyles.ghostButton}
                    onClick={() => {
                      setShowItemForm(false);
                      setEditingItemId(null);
                    }}
                    disabled={busy}
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    className={sharedStyles.primaryButton}
                    onClick={() => void handleSaveItem()}
                    disabled={busy || !itemForm.title.trim()}
                  >
                    {busy ? '保存中…' : editingItemId ? '項目を更新' : '項目を追加'}
                  </button>
                </div>
              </div>
            )}

            {items.length === 0 ? (
              <p className={styles.muted}>まだ項目がありません</p>
            ) : (
              <ul className={styles.itemList}>
                {items.map((item) => (
                  <li key={item.id} className={styles.itemCard}>
                    <div className={styles.itemMeta}>
                      <span className={styles.badge}>
                        {item.itemType === 'question' ? '質問' : 'ミッション'}
                      </span>
                      <span className={styles.badge}>
                        {item.isRequired ? '必須' : 'おまけ'}
                      </span>
                      <span className={styles.muted}>#{item.sortOrder}</span>
                    </div>
                    <strong>{item.title}</strong>
                    {item.description && <p className={styles.muted}>{item.description}</p>}
                    <div className={styles.actions}>
                      {isDraft && (
                        <>
                          <button
                            type="button"
                            className={sharedStyles.ghostButton}
                            onClick={() => startEditItem(item)}
                            disabled={busy}
                          >
                            編集
                          </button>
                          <button
                            type="button"
                            className={sharedStyles.ghostButton}
                            onClick={() => void handleDeleteItem(item)}
                            disabled={busy}
                          >
                            削除
                          </button>
                        </>
                      )}
                      {!isDraft && (
                        <button
                          type="button"
                          className={sharedStyles.ghostButton}
                          onClick={() => void openManagerResponses(item.id)}
                          disabled={busy}
                        >
                          回答を見る
                        </button>
                      )}
                    </div>
                    {responsesItemId === item.id && (
                      <div className={styles.itemForm}>
                        <p className={styles.itemFormTitle}>
                          管理者だけに公開された回答
                        </p>
                        <p className={styles.muted}>
                          「自分だけ」の回答は件数・内容とも表示しません。
                        </p>
                        {responsesLoading && <p className={styles.muted}>読み込み中…</p>}
                        {responsesError && <p className={styles.error}>{responsesError}</p>}
                        {!responsesLoading && !responsesError && managerResponses.length === 0 && (
                          <p className={styles.muted}>表示できる回答はまだありません</p>
                        )}
                        <ul className={styles.itemList}>
                          {managerResponses.map((response) => (
                            <li key={response.id} className={styles.itemCard}>
                              <div className={styles.itemMeta}>
                                <span className={styles.badge}>管理者だけ</span>
                                <span className={styles.muted}>
                                  参加者 {response.userId.slice(0, 8)}…
                                </span>
                                <span className={styles.muted}>
                                  {formatUpdatedAt(response.updatedAt)}
                                </span>
                              </div>
                              <p className={styles.muted}>{response.comment}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </SettingsSection>

          {formError && <p className={styles.error}>{formError}</p>}
        </SettingsPageHeader>
        {toast && (
          <div className={`${sharedStyles.toast} ${sharedStyles.toastSuccess}`}>{toast}</div>
        )}
      </>
    );
  }

  return (
    <>
      <SettingsPageHeader
        title="質問・ミッション管理"
        description="Hossiiからの挑戦状を作成・公開します。公開後は参加者がコメント回答できます。"
      >
        <div className={styles.actions}>
          <button
            type="button"
            className={sharedStyles.primaryButton}
            onClick={openCreate}
            disabled={busy || loading}
          >
            新しい挑戦状を作る
          </button>
        </div>

        {loading && <p className={styles.muted}>読み込み中…</p>}
        {loadError && <p className={styles.error}>{loadError}</p>}

        {!loading && !loadError && programs.length === 0 && (
          <p className={styles.empty}>まだ挑戦状はありません。下書きから作成できます。</p>
        )}

        <ul className={styles.programList}>
          {programs.map((program) => {
            const isDraft = program.status === 'draft';
            return (
              <li key={program.id} className={styles.programCard}>
                <div className={styles.itemMeta}>
                  <span className={styles.badge}>{statusLabel(program.status)}</span>
                  <span className={styles.muted}>
                    項目 {itemCounts[program.id] ?? 0} 件
                  </span>
                  <span className={styles.muted}>{formatUpdatedAt(program.updatedAt)}</span>
                </div>
                <strong>{program.title}</strong>
                {program.description && (
                  <p className={styles.muted}>{program.description}</p>
                )}
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={sharedStyles.primaryButton}
                    onClick={() => void openEdit(program.id)}
                    disabled={busy}
                  >
                    {isDraft ? '編集' : '内容を見る'}
                  </button>
                  {isDraft ? (
                    <button
                      type="button"
                      className={sharedStyles.ghostButton}
                      onClick={() => void handleDeleteProgram(program)}
                      disabled={busy}
                    >
                      削除
                    </button>
                  ) : (
                    <span className={styles.muted}>削除不可</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </SettingsPageHeader>
      {toast && (
        <div className={`${sharedStyles.toast} ${sharedStyles.toastSuccess}`}>{toast}</div>
      )}
    </>
  );
};
