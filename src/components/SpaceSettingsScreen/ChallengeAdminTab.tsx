import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { fetchParticipantAccounts } from '../../core/utils/participantAccountsApi';
import { fetchSpaceMembershipNicknames } from '../../core/utils/spaceMembershipsApi';
import {
  buildChallengePublishChecks,
  clampAdminDescription,
  countChallengeItemStats,
  formatChallengeResponderLabel,
  hasUnsavedProgramEdits,
  itemFormHasContent,
  toParticipantItemSaveError,
  validateChallengeItemForm,
  type ChallengeItemCountStats,
} from '../../core/utils/challengeAdminDisplay';
import { invalidatePublishedChallengeNavCache } from '../../core/hooks/useHasPublishedChallengePrograms';
import type { ChallengeResponse } from '../../core/types/challengeResponse';
import { ChallengeAdminItemCard } from './ChallengeAdminItemCard';
import {
  ChallengeAdminItemEditor,
  type ChallengeAdminItemFormState,
} from './ChallengeAdminItemEditor';
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

type ManagerResponseRow = ChallengeResponse & {
  itemTitle: string;
  itemType: ChallengeItemType;
};

const EMPTY_ITEM_FORM: ChallengeAdminItemFormState = {
  itemType: 'question',
  title: '',
  description: '',
  reason: '',
  isRequired: true,
};

const LIST_LOAD_ERROR_TITLE = '挑戦状を読み込めませんでした';
const LIST_LOAD_ERROR_HINT = '時間をおいて、もう一度お試しください';

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

async function resolveResponderNames(
  spaceId: string,
  userIds: string[],
): Promise<Record<string, string>> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) return {};
  const names: Record<string, string> = {};

  try {
    const nicknames = await fetchSpaceMembershipNicknames(spaceId);
    for (const userId of uniqueIds) {
      const nickname = nicknames.get(userId);
      if (nickname) names[userId] = nickname;
    }
  } catch {
    // Keep fallbacks; nickname lookup must not block response viewing.
  }

  try {
    const accounts = await fetchParticipantAccounts(spaceId);
    for (const account of accounts) {
      if (!uniqueIds.includes(account.authUserId) || names[account.authUserId]) continue;
      const loginId = account.loginId?.trim();
      if (loginId) names[account.authUserId] = loginId;
    }
  } catch {
    // Optional fallback only.
  }

  return names;
}

export const ChallengeAdminTab = ({ space }: Props) => {
  const { currentUser } = useAuth();
  const canManage = canManageSpace(currentUser, space);

  const [view, setView] = useState<View>({ kind: 'list' });
  const [programs, setPrograms] = useState<ChallengeProgram[]>([]);
  const [itemStatsByProgram, setItemStatsByProgram] = useState<
    Record<string, ChallengeItemCountStats>
  >({});
  const [items, setItems] = useState<ChallengeItem[]>([]);
  const [editingProgram, setEditingProgram] = useState<ChallengeProgram | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [programTitle, setProgramTitle] = useState('');
  const [programDescription, setProgramDescription] = useState('');
  const [itemForm, setItemForm] = useState<ChallengeAdminItemFormState>(EMPTY_ITEM_FORM);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [showItemForm, setShowItemForm] = useState(false);
  const [itemFormError, setItemFormError] = useState<string | null>(null);

  const [managerResponses, setManagerResponses] = useState<ManagerResponseRow[]>([]);
  const [responsesLoading, setResponsesLoading] = useState(false);
  const [responsesError, setResponsesError] = useState<string | null>(null);
  const [responderNames, setResponderNames] = useState<Record<string, string>>({});

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
      const stats: Record<string, ChallengeItemCountStats> = {};
      await Promise.all(
        listed.map(async (program) => {
          const programItems = await listChallengeItems(program.id);
          stats[program.id] = countChallengeItemStats(programItems);
        }),
      );
      setItemStatsByProgram(stats);
    } catch {
      setLoadError(LIST_LOAD_ERROR_TITLE);
      setPrograms([]);
      setItemStatsByProgram({});
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

  useEffect(() => {
    setView({ kind: 'list' });
    setEditingProgram(null);
    setItems([]);
    setManagerResponses([]);
    setResponderNames({});
    setFormError(null);
  }, [space.id]);

  const loadManagerResponsesForItems = useCallback(
    async (programItems: ChallengeItem[]) => {
      setResponsesLoading(true);
      setResponsesError(null);
      try {
        const grouped = await Promise.all(
          programItems.map(async (item) => {
            const listed = await listManagerChallengeResponses(item.id);
            return listed.map((response) => ({
              ...response,
              itemTitle: item.title,
              itemType: item.itemType,
            }));
          }),
        );
        const flat = grouped.flat().sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        setManagerResponses(flat);
        setResponderNames(
          await resolveResponderNames(
            space.id,
            flat.map((response) => response.userId),
          ),
        );
      } catch {
        setManagerResponses([]);
        setResponderNames({});
        setResponsesError('回答を読み込めませんでした');
      } finally {
        setResponsesLoading(false);
      }
    },
    [space.id],
  );

  const openCreate = () => {
    setProgramTitle('');
    setProgramDescription('');
    setFormError(null);
    setView({ kind: 'create' });
  };

  const openEdit = async (programId: string) => {
    setFormError(null);
    setBusy(true);
    setManagerResponses([]);
    setResponsesError(null);
    try {
      const listed = await listChallengePrograms(space.id);
      const program = listed.find((p) => p.id === programId) ?? null;
      if (!program) {
        setFormError('挑戦状が見つかりません');
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
      setItemFormError(null);
      setView({ kind: 'edit', programId });
      if (program.status === 'published') {
        void loadManagerResponsesForItems(programItems);
      }
    } finally {
      setBusy(false);
    }
  };

  const backToList = async () => {
    setView({ kind: 'list' });
    setEditingProgram(null);
    setItems([]);
    setManagerResponses([]);
    setResponderNames({});
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
    showToast('下書きの挑戦状を作成しました');
    await openEdit(result.value.id);
  };

  const handleSaveProgram = async () => {
    if (!editingProgram || busy) return;
    if (editingProgram.status !== 'draft') {
      setFormError('下書き以外の挑戦状は編集できません');
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
    showToast('下書きを保存しました');
  };

  const handleDeleteProgram = async (program: ChallengeProgram) => {
    if (busy) return;
    if (program.status !== 'draft') {
      window.alert('下書き以外の挑戦状は削除できません');
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
    showToast('挑戦状を削除しました');
    if (view.kind === 'edit' && view.programId === program.id) {
      await backToList();
    } else {
      await reloadPrograms();
    }
  };

  const closeItemForm = () => {
    setShowItemForm(false);
    setEditingItemId(null);
    setItemForm(EMPTY_ITEM_FORM);
    setItemFormError(null);
  };

  const startAddItem = (itemType: ChallengeItemType) => {
    setFormError(null);
    setItemFormError(null);
    if (showItemForm && editingItemId) {
      const ok = window.confirm(
        '編集中の内容を破棄して、新しい項目を追加しますか？',
      );
      if (!ok) return;
      setEditingItemId(null);
      setItemForm({ ...EMPTY_ITEM_FORM, itemType });
      setShowItemForm(true);
      return;
    }
    if (showItemForm && !editingItemId) {
      // Keep in-progress create form; only switch type.
      setItemForm((prev) => ({ ...prev, itemType }));
      return;
    }
    setEditingItemId(null);
    setItemForm({ ...EMPTY_ITEM_FORM, itemType });
    setShowItemForm(true);
  };

  const startEditItem = (item: ChallengeItem) => {
    setFormError(null);
    setItemFormError(null);
    if (
      showItemForm &&
      !editingItemId &&
      itemFormHasContent(itemForm)
    ) {
      const ok = window.confirm(
        '入力中の新しい項目を破棄して、この項目を編集しますか？',
      );
      if (!ok) return;
    }
    if (showItemForm && editingItemId && editingItemId !== item.id) {
      const ok = window.confirm(
        '別の項目を編集中です。内容を破棄して切り替えますか？',
      );
      if (!ok) return;
    }
    setEditingItemId(item.id);
    setItemForm({
      itemType: item.itemType,
      title: item.title,
      description: item.description ?? '',
      reason: item.reason ?? '',
      isRequired: item.isRequired,
    });
    setShowItemForm(true);
  };

  const handleSaveItem = async () => {
    if (!editingProgram || busy) return;
    if (editingProgram.status !== 'draft') {
      setItemFormError('下書き以外では項目を変更できません');
      return;
    }
    const validationError = validateChallengeItemForm(itemForm);
    if (validationError) {
      setItemFormError(validationError);
      return;
    }
    setBusy(true);
    setItemFormError(null);
    setFormError(null);

    if (editingItemId) {
      const result = await updateChallengeItem(editingItemId, {
        itemType: itemForm.itemType,
        title: itemForm.title.trim(),
        description: itemForm.description,
        reason: itemForm.reason,
        isRequired: itemForm.isRequired,
        responseType: 'comment',
      });
      setBusy(false);
      if (!result.ok) {
        setItemFormError(toParticipantItemSaveError(result.error));
        return;
      }
      showToast('項目を更新しました');
    } else {
      const nextSort =
        items.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1;
      const result = await createChallengeItem({
        programId: editingProgram.id,
        itemType: itemForm.itemType,
        title: itemForm.title.trim(),
        description: itemForm.description,
        reason: itemForm.reason,
        isRequired: itemForm.isRequired,
        responseType: 'comment',
        sortOrder: nextSort,
      });
      setBusy(false);
      if (!result.ok) {
        setItemFormError(toParticipantItemSaveError(result.error));
        return;
      }
      showToast('項目を追加しました');
    }

    const refreshed = await listChallengeItems(editingProgram.id);
    setItems(refreshed);
    closeItemForm();
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
    if (items.length === 0) {
      setFormError('公開するには質問またはミッションが1件以上必要です');
      return;
    }
    const commentItems = items.filter((item) => item.responseType === 'comment');
    if (commentItems.length === 0) {
      setFormError('公開するにはコメント形式の項目が1件以上必要です');
      return;
    }
    if (
      hasUnsavedProgramEdits({
        title: programTitle,
        description: programDescription,
        savedTitle: editingProgram.title,
        savedDescription: editingProgram.description,
      }) ||
      showItemForm
    ) {
      setFormError('先に下書きを保存してください。未保存の変更がある状態では公開できません。');
      return;
    }
    const ok = window.confirm(
      `この挑戦状を公開しますか？\n「${programTitle.trim()}」が参加者の画面に表示され、質問・ミッションの内容は変更できなくなります。`,
    );
    if (!ok) return;
    setBusy(true);
    setFormError(null);
    const result = await updateChallengeProgramStatus(editingProgram.id, 'published');
    setBusy(false);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    setEditingProgram(result.value);
    invalidatePublishedChallengeNavCache(space.id);
    showToast('挑戦状を公開しました');
    void loadManagerResponsesForItems(items);
  };

  const programDirty = useMemo(() => {
    if (!editingProgram) return false;
    return hasUnsavedProgramEdits({
      title: programTitle,
      description: programDescription,
      savedTitle: editingProgram.title,
      savedDescription: editingProgram.description,
    });
  }, [editingProgram, programTitle, programDescription]);

  if (!canManage) {
    return (
      <SettingsPageHeader
        title="挑戦状の管理"
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
          description="下書きとして作成します。項目を追加したあと、編集画面から公開できます。"
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
            {formError && (
              <p className={styles.error} role="alert">
                {formError}
              </p>
            )}
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
          <div className={`${sharedStyles.toast} ${sharedStyles.toastSuccess}`} aria-live="polite">
            {toast}
          </div>
        )}
      </>
    );
  }

  if (view.kind === 'edit' && editingProgram) {
    const isDraft = editingProgram.status === 'draft';
    const itemStats = countChallengeItemStats(items);
    const publishChecks = buildChallengePublishChecks({
      title: programTitle,
      itemTotal: itemStats.total,
      requiredTotal: itemStats.required,
    });
    const canPublish =
      isDraft &&
      programTitle.trim().length > 0 &&
      items.length > 0 &&
      !programDirty &&
      !showItemForm;

    return (
      <>
        <SettingsPageHeader
          title={editingProgram.title || '挑戦状の編集'}
          description="参加者に届ける質問やミッションを作成・公開できます"
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
          </div>

          <section
            className={`${styles.statusBanner} ${
              isDraft ? styles.statusBannerDraft : styles.statusBannerPublished
            }`}
            aria-label="挑戦状の公開状態"
          >
            <p className={styles.statusBannerTitle}>
              {isDraft ? '下書き' : '公開中'}
            </p>
            <p className={styles.statusBannerText}>
              {isDraft
                ? '参加者にはまだ表示されていません'
                : '参加者の挑戦状画面に表示されています。公開後は質問・ミッションの内容を変更できません。'}
            </p>
          </section>

          <SettingsSection title={isDraft ? '挑戦状の内容' : '挑戦状の内容'}>
            {!isDraft && (
              <p className={styles.warning}>
                公開済みのため、タイトル・説明・項目の追加や削除はできません。管理者に共有された回答は下のセクションで確認できます。
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
                  {busy ? '保存中…' : '下書きを保存'}
                </button>
              </div>
            )}
          </SettingsSection>

          <SettingsSection title="質問・ミッション">
            <div className={styles.typeExplain}>
              <p>
                <strong>質問</strong>
                考えたことや気づきを、コメントで書いてもらう項目です
              </p>
              <p>
                <strong>ミッション</strong>
                行動したことや、できたことを報告してもらう項目です
              </p>
            </div>

            {!isDraft && (
              <p className={styles.warning}>公開後は内容を変更できません</p>
            )}

            <div className={styles.itemListHeader}>
              <h3 className={styles.itemListHeading}>作成済み項目</h3>
              {items.length > 0 ? (
                <p className={styles.muted}>
                  参加者には上からこの順番で表示されます
                </p>
              ) : null}
            </div>

            {items.length === 0 ? (
              <p className={styles.muted}>まだ項目がありません</p>
            ) : (
              <ul className={styles.itemList}>
                {items.map((item, index) => (
                  <li key={item.id}>
                    <ChallengeAdminItemCard
                      item={item}
                      order={index + 1}
                      readOnly={!isDraft}
                      busy={busy}
                      onEdit={() => startEditItem(item)}
                      onDelete={() => void handleDeleteItem(item)}
                    />
                    {isDraft &&
                    showItemForm &&
                    editingItemId === item.id ? (
                      <ChallengeAdminItemEditor
                        mode="edit"
                        value={itemForm}
                        busy={busy}
                        error={itemFormError}
                        onChange={setItemForm}
                        onSubmit={() => void handleSaveItem()}
                        onCancel={closeItemForm}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {isDraft && (
              <div className={styles.addBlock}>
                <h3 className={styles.itemListHeading}>新しい項目を追加</h3>
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
                {showItemForm && !editingItemId ? (
                  <ChallengeAdminItemEditor
                    mode="create"
                    value={itemForm}
                    busy={busy}
                    error={itemFormError}
                    onChange={setItemForm}
                    onSubmit={() => void handleSaveItem()}
                    onCancel={closeItemForm}
                  />
                ) : null}
              </div>
            )}
          </SettingsSection>

          {isDraft && (
            <SettingsSection title="参加者へ公開">
              <p className={styles.muted}>
                公開すると、参加者の「挑戦状」に表示されます。
                公開後は質問・ミッションの内容を変更できません。
              </p>
              <div className={styles.publishChecks} aria-label="公開前チェック">
                <p className={styles.publishChecksTitle}>公開前チェック</p>
                <ul className={styles.publishCheckList}>
                  {publishChecks.map((check) => (
                    <li
                      key={check.id}
                      className={
                        check.ok ? styles.publishCheckOk : styles.publishCheckNg
                      }
                    >
                      {check.ok ? '✓' : '・'} {check.label}
                    </li>
                  ))}
                </ul>
              </div>
              {programDirty && (
                <p className={styles.warning}>
                  未保存の変更があります。先に「下書きを保存」してください。
                </p>
              )}
              {showItemForm && (
                <p className={styles.warning}>
                  項目の編集中です。保存または入力をやめてから公開してください。
                </p>
              )}
              <div className={styles.actions}>
                <button
                  type="button"
                  className={sharedStyles.primaryButton}
                  onClick={() => void handlePublish()}
                  disabled={busy || !canPublish}
                >
                  {busy ? '公開中…' : 'この挑戦状を公開する'}
                </button>
              </div>
            </SettingsSection>
          )}

          {!isDraft && (
            <SettingsSection title="管理者に共有された回答">
              <p className={styles.responseNotice}>
                ここには「管理者にだけ共有」を選んだ回答だけが表示されます。
                「自分だけに残す」を選んだ回答は、件数にも含まれません。
              </p>
              {responsesLoading && (
                <p className={styles.muted} aria-live="polite">
                  回答を読み込んでいます…
                </p>
              )}
              {responsesError && (
                <p className={styles.error} role="alert">
                  {responsesError}
                </p>
              )}
              {!responsesLoading && !responsesError && managerResponses.length === 0 && (
                <p className={styles.empty}>管理者に共有された回答はまだありません</p>
              )}
              {!responsesLoading && managerResponses.length > 0 && (
                <ul className={styles.responseList}>
                  {managerResponses.map((response) => (
                    <li key={response.id}>
                      <article className={styles.responseCard}>
                        <div className={styles.itemMeta}>
                          <span className={styles.responderName}>
                            {formatChallengeResponderLabel(response.userId, responderNames)}
                          </span>
                          <span className={styles.muted}>
                            {formatUpdatedAt(response.updatedAt)}
                          </span>
                          <span className={styles.badge}>管理者にだけ共有</span>
                        </div>
                        <p className={styles.responseItemTitle}>
                          {response.itemType === 'question' ? '質問' : 'ミッション'}：
                          {response.itemTitle}
                        </p>
                        <p className={styles.responseBody}>{response.comment}</p>
                      </article>
                    </li>
                  ))}
                </ul>
              )}
            </SettingsSection>
          )}

          {isDraft && (
            <SettingsSection title="その他の操作">
              <p className={styles.muted}>下書きの挑戦状のみ削除できます。</p>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.dangerButton}
                  onClick={() => void handleDeleteProgram(editingProgram)}
                  disabled={busy}
                >
                  この下書きを削除
                </button>
              </div>
            </SettingsSection>
          )}

          {formError && (
            <p className={styles.error} role="alert" aria-live="polite">
              {formError}
            </p>
          )}
        </SettingsPageHeader>
        {toast && (
          <div className={`${sharedStyles.toast} ${sharedStyles.toastSuccess}`} aria-live="polite">
            {toast}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <SettingsPageHeader
        title="挑戦状の管理"
        description="参加者に届ける質問やミッションを作成・公開できます"
      >
        <div className={styles.topActions}>
          <button
            type="button"
            className={sharedStyles.primaryButton}
            onClick={openCreate}
            disabled={busy || loading}
          >
            新しい挑戦状をつくる
          </button>
        </div>

        <p className={styles.introHint}>
          質問：考えたことや気づきを書いてもらう項目 ／
          ミッション：行動したことや達成を報告してもらう項目
        </p>

        {loading && (
          <div className={styles.loadingBlock} aria-busy="true" aria-live="polite">
            <p className={styles.muted}>挑戦状を読み込んでいます…</p>
            <div className={styles.skeleton} />
            <div className={styles.skeleton} />
          </div>
        )}

        {!loading && loadError && (
          <div className={styles.errorBlock} role="alert">
            <p className={styles.error}>{LIST_LOAD_ERROR_TITLE}</p>
            <p className={styles.muted}>{LIST_LOAD_ERROR_HINT}</p>
            <button
              type="button"
              className={sharedStyles.ghostButton}
              onClick={() => void reloadPrograms()}
            >
              もう一度試す
            </button>
          </div>
        )}

        {!loading && !loadError && programs.length === 0 && (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>まだ挑戦状はありません</p>
            <p className={styles.muted}>最初の質問やミッションをつくってみましょう</p>
            <button
              type="button"
              className={sharedStyles.primaryButton}
              onClick={openCreate}
              disabled={busy}
            >
              挑戦状をつくる
            </button>
          </div>
        )}

        {!loading && !loadError && programs.length > 0 && (
          <ul className={styles.programList}>
            {programs.map((program) => {
              const isDraft = program.status === 'draft';
              const stats = itemStatsByProgram[program.id] ?? {
                total: 0,
                required: 0,
                optional: 0,
              };
              const description = clampAdminDescription(program.description);
              return (
                <li key={program.id} className={styles.programCard}>
                  <div className={styles.itemMeta}>
                    <span
                      className={`${styles.statusBadge} ${
                        isDraft ? styles.statusDraft : styles.statusPublished
                      }`}
                    >
                      {statusLabel(program.status)}
                    </span>
                    <span className={styles.muted}>項目 {stats.total} 件</span>
                    <span className={styles.muted}>
                      必須 {stats.required} ／ おまけ {stats.optional}
                    </span>
                    <span className={styles.muted}>
                      更新 {formatUpdatedAt(program.updatedAt)}
                    </span>
                  </div>
                  <strong className={styles.programTitle}>{program.title}</strong>
                  {description ? (
                    <p className={styles.programDescription}>{description}</p>
                  ) : (
                    <p className={styles.muted}>説明なし</p>
                  )}
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={sharedStyles.primaryButton}
                      onClick={() => void openEdit(program.id)}
                      disabled={busy}
                    >
                      {isDraft ? '編集をつづける' : '内容・回答を見る'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SettingsPageHeader>
      {toast && (
        <div className={`${sharedStyles.toast} ${sharedStyles.toastSuccess}`} aria-live="polite">
          {toast}
        </div>
      )}
    </>
  );
};
