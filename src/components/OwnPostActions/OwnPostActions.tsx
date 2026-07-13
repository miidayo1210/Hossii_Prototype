import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, Pencil, EyeOff, Eye, Trash2 } from 'lucide-react';
import type { Hossii } from '../../core/types';
import { useHossiiActions } from '../../core/hooks/useHossiiActions';
import { isEditedMessageValid, nextVisibilityToggle } from '../../core/utils/ownPostEditRules';
import styles from './OwnPostActions.module.css';

type Props = {
  hossii: Hossii;
  /** 削除成功時に親（詳細モーダル等）を閉じるためのコールバック */
  onDeleted?: () => void;
  className?: string;
  /**
   * 表示形式。
   * - 'menu'（既定）: ⋮ ボタン + ドロップダウン。詳細モーダル等の狭い場所向け。
   * - 'bar': 鉛筆 / 目・鍵 / ゴミ箱 の3アイコンを直接並べる。吹き出し直下など、
   *   ユーザーがすぐ気づける位置に置く用途。
   */
  variant?: 'menu' | 'bar';
};

type Mode = 'idle' | 'editing' | 'confirmDelete';

/**
 * Phase 2D-2: ログイン本人向けの投稿操作メニュー（編集 / 公開範囲 / 削除）。
 *
 * この UI を出すかどうかは呼び出し側が canManageOwnPost で判定する（本人・authorship ready のみ）。
 * 実際の権限は DB(RPC + RLS) が正本で、ここは表示・操作導線のみ。ゲスト投稿・他人投稿には出さない。
 */
export const OwnPostActions = ({
  hossii,
  onDeleted,
  className,
  variant = 'menu',
}: Props) => {
  const { editMyHossiiContent, setMyHossiiVisibilityAction, softDeleteMyHossiiAction } =
    useHossiiActions();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('idle');
  const [draft, setDraft] = useState(hossii.message ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const isOwnerOnly = hossii.visibility === 'owner_only';

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const openEdit = () => {
    setDraft(hossii.message ?? '');
    setError(null);
    setMode('editing');
    setMenuOpen(false);
  };

  const openDelete = () => {
    setError(null);
    setMode('confirmDelete');
    setMenuOpen(false);
  };

  const closeOverlay = () => {
    if (busy) return;
    setMode('idle');
    setError(null);
  };

  const handleToggleVisibility = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const next = nextVisibilityToggle(hossii.visibility);
    const res = await setMyHossiiVisibilityAction(hossii.id, next);
    setBusy(false);
    if (!res.ok) {
      setError('公開範囲の変更に失敗しました。時間をおいて再度お試しください。');
      return;
    }
    setMenuOpen(false);
  };

  const handleSaveEdit = async () => {
    if (busy) return;
    if (!isEditedMessageValid(hossii, draft)) {
      setError('本文を入力してください。');
      return;
    }
    setBusy(true);
    setError(null);
    const res = await editMyHossiiContent(hossii.id, draft.trim());
    setBusy(false);
    if (!res.ok) {
      setError('保存に失敗しました。時間をおいて再度お試しください。');
      return;
    }
    setMode('idle');
  };

  const handleConfirmDelete = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await softDeleteMyHossiiAction(hossii.id);
    setBusy(false);
    if (!res.ok) {
      setError('削除に失敗しました。時間をおいて再度お試しください。');
      return;
    }
    setMode('idle');
    onDeleted?.();
  };

  const overlays = (
    <>
      {mode === 'editing' &&
        createPortal(
          <div className={styles.overlay} onMouseDown={closeOverlay}>
            <div
              className={styles.dialog}
              onMouseDown={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="投稿を編集"
            >
              <h2 className={styles.dialogTitle}>投稿を編集</h2>
              <textarea
                className={styles.textarea}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={4}
                autoFocus
                disabled={busy}
                placeholder="本文を入力"
              />
              {error && <p className={styles.dialogError}>{error}</p>}
              <div className={styles.dialogActions}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={closeOverlay}
                  disabled={busy}
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={handleSaveEdit}
                  disabled={busy}
                >
                  {busy ? '保存中…' : '保存'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {mode === 'confirmDelete' &&
        createPortal(
          <div className={styles.overlay} onMouseDown={closeOverlay}>
            <div
              className={styles.dialog}
              onMouseDown={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="投稿を削除"
            >
              <h2 className={styles.dialogTitle}>この投稿を削除しますか？</h2>
              <p className={styles.dialogBody}>
                削除するとこの投稿は一覧から見えなくなります。この操作は取り消せません。
              </p>
              {error && <p className={styles.dialogError}>{error}</p>}
              <div className={styles.dialogActions}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={closeOverlay}
                  disabled={busy}
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  className={styles.dangerBtn}
                  onClick={handleConfirmDelete}
                  disabled={busy}
                >
                  {busy ? '削除中…' : '削除する'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );

  if (variant === 'bar') {
    return (
      <div className={`${styles.bar} ${className ?? ''}`} ref={rootRef}>
        <button
          type="button"
          className={styles.barBtn}
          aria-label="編集する"
          title="編集する"
          onClick={openEdit}
          disabled={busy}
        >
          <Pencil size={16} />
        </button>
        <button
          type="button"
          className={styles.barBtn}
          aria-label={isOwnerOnly ? 'みんなに公開する' : '自分だけに見せる'}
          title={isOwnerOnly ? 'みんなに公開する' : '自分だけに見せる'}
          onClick={handleToggleVisibility}
          disabled={busy}
        >
          {isOwnerOnly ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>
        <button
          type="button"
          className={`${styles.barBtn} ${styles.barBtnDanger}`}
          aria-label="削除する"
          title="削除する"
          onClick={openDelete}
          disabled={busy}
        >
          <Trash2 size={16} />
        </button>
        {error && mode === 'idle' && <span className={styles.barError}>{error}</span>}
        {overlays}
      </div>
    );
  }

  return (
    <div className={`${styles.root} ${className ?? ''}`} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-label="自分の投稿を操作"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => {
          setError(null);
          setMenuOpen((v) => !v);
        }}
      >
        <MoreVertical size={16} />
      </button>

      {menuOpen && (
        <div className={styles.menu} role="menu">
          <button
            type="button"
            role="menuitem"
            className={styles.menuItem}
            onClick={openEdit}
            disabled={busy}
          >
            <Pencil size={14} /> 編集する
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles.menuItem}
            onClick={handleToggleVisibility}
            disabled={busy}
          >
            {isOwnerOnly ? (
              <>
                <Eye size={14} /> みんなに公開する
              </>
            ) : (
              <>
                <EyeOff size={14} /> 自分だけに見せる
              </>
            )}
          </button>
          <button
            type="button"
            role="menuitem"
            className={`${styles.menuItem} ${styles.menuItemDanger}`}
            onClick={openDelete}
            disabled={busy}
          >
            <Trash2 size={14} /> 削除する
          </button>
          {error && <p className={styles.menuError}>{error}</p>}
        </div>
      )}

      {overlays}
    </div>
  );
};
