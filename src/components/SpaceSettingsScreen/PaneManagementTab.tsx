import { useCallback, useState } from 'react';
import { ChevronDown, ChevronUp, Eye, EyeOff, Link2, Plus, QrCode, Trash2 } from 'lucide-react';
import type { SpacePane } from '../../core/types/spacePane';
import { isSupabaseConfigured } from '../../core/supabase';
import { useSpacePane } from '../../core/hooks/SpacePaneProvider';
import {
  applySpacePaneSortOrders,
  deleteSpacePane,
  setSpacePaneVisible,
  updateSpacePane,
} from '../../core/utils/spacePanesApi';
import {
  MAX_PANE_NAME_LEN,
  MAX_SPACE_PANES,
  canCreatePane,
  canDeletePane,
  canHidePane,
  computeReorderUpdates,
  paneLimitMessage,
  sortPanesForDisplay,
  validatePaneName,
} from '../../core/utils/spacePaneManagement';
import { SpacePaneCreateDialog } from '../SpaceScreen/SpacePaneCreateDialog';
import { SettingsPageHeader } from './SettingsPageHeader';
import { PaneSlugEditDialog } from './PaneSlugEditDialog';
import { PaneShareDialog } from './PaneShareDialog';
import sharedStyles from './SettingsShared.module.css';
import styles from './PaneManagementTab.module.css';

type Props = {
  spaceId: string;
  spaceURL: string | undefined;
};

function showToast(setter: (msg: string | null) => void, message: string) {
  setter(message);
  setTimeout(() => setter(null), 3000);
}

export function PaneManagementTab({ spaceId, spaceURL }: Props) {
  const { panes, defaultPane, reloadPanesAndSyncActive, setActivePaneById } = useSpacePane();
  const [toast, setToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [slugEditPane, setSlugEditPane] = useState<SpacePane | null>(null);
  const [sharePane, setSharePane] = useState<SpacePane | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const sorted = sortPanesForDisplay(panes);
  const canAdd = canCreatePane(panes.length);

  const handleError = useCallback((message: string) => {
    setErrorToast(message);
    setTimeout(() => setErrorToast(null), 4000);
  }, []);

  const syncAfterChange = useCallback(async (successMessage: string) => {
    await reloadPanesAndSyncActive();
    showToast(setToast, successMessage);
  }, [reloadPanesAndSyncActive]);

  const startEditName = (pane: SpacePane) => {
    setEditingId(pane.id);
    setEditName(pane.name);
  };

  const cancelEditName = () => {
    setEditingId(null);
    setEditName('');
  };

  const saveName = async (pane: SpacePane) => {
    const validation = validatePaneName(editName);
    if (validation) {
      handleError(validation);
      return;
    }
    const trimmed = editName.trim();
    if (trimmed === pane.name) {
      cancelEditName();
      return;
    }

    setBusyId(pane.id);
    try {
      const updated = await updateSpacePane(pane.id, { name: trimmed });
      if (!updated) {
        handleError('名称の保存に失敗しました');
        return;
      }
      cancelEditName();
      await syncAfterChange('タブ名を保存しました');
    } finally {
      setBusyId(null);
    }
  };

  const handleReorder = async (pane: SpacePane, direction: 'up' | 'down') => {
    const updates = computeReorderUpdates(panes, pane.id, direction);
    if (updates.length === 0) return;

    setBusyId(pane.id);
    try {
      const ok = await applySpacePaneSortOrders(updates);
      if (!ok) {
        handleError('並び替えに失敗しました');
        await reloadPanesAndSyncActive();
        return;
      }
      await syncAfterChange('並び順を更新しました');
    } finally {
      setBusyId(null);
    }
  };

  const handleVisibility = async (pane: SpacePane, visible: boolean) => {
    if (!visible && !canHidePane(pane)) return;

    setBusyId(pane.id);
    try {
      const updated = await setSpacePaneVisible(pane.id, visible);
      if (!updated) {
        handleError(visible ? '再表示に失敗しました' : '非表示に失敗しました');
        return;
      }
      await syncAfterChange(visible ? 'タブを再表示しました' : 'タブを非表示にしました');
    } finally {
      setBusyId(null);
    }
  };

  const handleCreated = async (pane: SpacePane) => {
    await reloadPanesAndSyncActive();
    setActivePaneById(pane.id);
    showToast(setToast, 'タブを追加しました');
  };

  const handleDelete = async (pane: SpacePane) => {
    if (!canDeletePane(pane)) return;

    const confirmed = window.confirm(
      `「${pane.name}」タブを削除しますか？\n\nこのタブに紐づく投稿はメインタブ側に表示されなくなります（投稿データ自体は残ります）。\nこの操作は取り消せません。`,
    );
    if (!confirmed) return;

    setBusyId(pane.id);
    try {
      const result = await deleteSpacePane(pane);
      if (!result.ok) {
        handleError(result.error);
        return;
      }
      await reloadPanesAndSyncActive();
      if (defaultPane) {
        setActivePaneById(defaultPane.id);
      }
      showToast(setToast, 'タブを削除しました');
    } finally {
      setBusyId(null);
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <SettingsPageHeader
        title="タブ管理"
        description="タブ管理は Supabase 接続時のみ利用できます。"
      >
        <div className={sharedStyles.section}>
          <p className={sharedStyles.sectionDescription}>
            デモ環境ではタブの追加・編集はスペース画面から行えます。
          </p>
        </div>
      </SettingsPageHeader>
    );
  }

  return (
    <>
      <SettingsPageHeader
        title="タブ管理"
        description="スペース内のタブ（Pane）の名称・表示順・slug を管理します。非表示にしたタブはバーに表示されませんが、一覧では確認できます。"
      >
        <div className={styles.toolbar}>
          <span className={styles.count}>
            {panes.length} / {MAX_SPACE_PANES} 件
          </span>
          <button
            type="button"
            className={styles.addButton}
            disabled={!canAdd}
            title={canAdd ? undefined : paneLimitMessage()}
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={16} />
            タブを追加
          </button>
        </div>

        <ul className={styles.list}>
          {sorted.map((pane, index) => {
            const isEditing = editingId === pane.id;
            const isBusy = busyId === pane.id;

            return (
              <li
                key={pane.id}
                className={`${styles.row}${!pane.isVisible ? ` ${styles.rowHidden}` : ''}`}
              >
                <div className={styles.rowMain}>
                  <div className={styles.nameBlock}>
                    {isEditing ? (
                      <div className={styles.nameEdit}>
                        <input
                          type="text"
                          className={styles.nameInput}
                          value={editName}
                          maxLength={MAX_PANE_NAME_LEN}
                          disabled={isBusy}
                          autoFocus
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void saveName(pane);
                            if (e.key === 'Escape') cancelEditName();
                          }}
                        />
                        <button
                          type="button"
                          className={styles.saveNameButton}
                          disabled={isBusy}
                          onClick={() => void saveName(pane)}
                        >
                          保存
                        </button>
                        <button
                          type="button"
                          className={styles.cancelNameButton}
                          disabled={isBusy}
                          onClick={cancelEditName}
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={styles.nameButton}
                        disabled={isBusy}
                        onClick={() => startEditName(pane)}
                      >
                        {pane.name}
                      </button>
                    )}
                    <span className={styles.slug}>/{pane.slug}</span>
                  </div>
                  <div className={styles.badges}>
                    {pane.isDefault && (
                      <span className={styles.badgeDefault}>メイン</span>
                    )}
                    {!pane.isVisible && (
                      <span className={styles.badgeHidden}>非表示</span>
                    )}
                  </div>
                  {pane.isDefault && (
                    <p className={styles.defaultHint}>
                      メインタブは非表示にできません
                    </p>
                  )}
                </div>

                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.iconButton}
                    disabled={isBusy || index === 0}
                    aria-label="上へ"
                    onClick={() => void handleReorder(pane, 'up')}
                  >
                    <ChevronUp size={18} />
                  </button>
                  <button
                    type="button"
                    className={styles.iconButton}
                    disabled={isBusy || index === sorted.length - 1}
                    aria-label="下へ"
                    onClick={() => void handleReorder(pane, 'down')}
                  >
                    <ChevronDown size={18} />
                  </button>
                  <button
                    type="button"
                    className={styles.iconButton}
                    disabled={isBusy}
                    aria-label="URL・QR コード"
                    title="URL・QR コード"
                    onClick={() => setSharePane(pane)}
                  >
                    <QrCode size={16} />
                  </button>
                  <button
                    type="button"
                    className={styles.iconButton}
                    disabled={isBusy}
                    aria-label="slug を変更"
                    title="slug を変更"
                    onClick={() => setSlugEditPane(pane)}
                  >
                    <Link2 size={16} />
                  </button>
                  {pane.isVisible ? (
                    <button
                      type="button"
                      className={styles.iconButton}
                      disabled={isBusy || !canHidePane(pane)}
                      aria-label="非表示"
                      title={
                        canHidePane(pane)
                          ? '非表示'
                          : 'メインタブは非表示にできません'
                      }
                      onClick={() => void handleVisibility(pane, false)}
                    >
                      <EyeOff size={16} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={styles.iconButton}
                      disabled={isBusy}
                      aria-label="再表示"
                      onClick={() => void handleVisibility(pane, true)}
                    >
                      <Eye size={16} />
                    </button>
                  )}
                  {canDeletePane(pane) && (
                    <button
                      type="button"
                      className={`${styles.iconButton} ${styles.deleteButton}`}
                      disabled={isBusy}
                      aria-label="タブを削除"
                      title="タブを削除"
                      onClick={() => void handleDelete(pane)}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </SettingsPageHeader>

      {toast && <div className={styles.toast}>{toast}</div>}
      {errorToast && <div className={styles.toastError}>{errorToast}</div>}

      <SpacePaneCreateDialog
        open={createOpen}
        spaceId={spaceId}
        existingPanes={panes}
        onClose={() => setCreateOpen(false)}
        onCreated={(pane) => void handleCreated(pane)}
        onError={handleError}
      />

      <PaneShareDialog
        open={sharePane !== null}
        pane={sharePane}
        spaceURL={spaceURL}
        spaceId={spaceId}
        onClose={() => setSharePane(null)}
      />

      <PaneSlugEditDialog
        open={slugEditPane !== null}
        pane={slugEditPane}
        existingPanes={panes}
        onClose={() => setSlugEditPane(null)}
        onSaved={() => void syncAfterChange('slug を更新しました')}
        onError={handleError}
      />
    </>
  );
}
