import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import styles from './ChallengeResponseActionMenu.module.css';

type Props = {
  itemTitle: string;
  disabled?: boolean;
  /** full: 書き直す+削除 / answerAgain: もう一度答えるのみ */
  variant?: 'full' | 'answerAgain';
  onRewrite: () => void;
  onDelete: () => Promise<void> | void;
  onAnswerAgain?: () => void;
};

type Mode = 'idle' | 'confirmDelete';

const MENU_WIDTH = 200;
const MENU_EST_HEIGHT = 104;
const BOTTOM_SAFE = 88;

function computeMenuPosition(anchor: HTMLElement): { top: number; left: number } {
  const rect = anchor.getBoundingClientRect();
  let left = rect.right - MENU_WIDTH;
  left = Math.max(8, Math.min(left, window.innerWidth - MENU_WIDTH - 8));
  const spaceBelow = window.innerHeight - rect.bottom - BOTTOM_SAFE;
  const openUp = spaceBelow < MENU_EST_HEIGHT && rect.top > MENU_EST_HEIGHT + 8;
  const top = openUp ? rect.top - MENU_EST_HEIGHT - 6 : rect.bottom + 6;
  return { top: Math.max(8, top), left };
}

export function ChallengeResponseActionMenu({
  itemTitle,
  disabled = false,
  variant = 'full',
  onRewrite,
  onDelete,
  onAnswerAgain,
}: Props) {
  const menuId = useId();
  const titleId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null,
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = (restoreFocus = true) => {
    setMenuOpen(false);
    setFocusedIndex(0);
    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  };

  useLayoutEffect(() => {
    if (!menuOpen) {
      setPosition(null);
      return;
    }
    const update = () => {
      const anchor = triggerRef.current;
      if (!anchor) return;
      setPosition(computeMenuPosition(anchor));
    };
    update();
    const frame = requestAnimationFrame(update);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      closeMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMenu(true);
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (mode !== 'confirmDelete') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        e.preventDefault();
        setMode('idle');
        setError(null);
        window.requestAnimationFrame(() => triggerRef.current?.focus());
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mode, busy]);

  const handleMenuKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setFocusedIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setFocusedIndex(1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (focusedIndex === 0) handleRewrite();
      else handleOpenDelete();
    }
  };

  const handleRewrite = () => {
    if (disabled || busy) return;
    closeMenu(false);
    onRewrite();
  };

  const handleOpenDelete = () => {
    if (disabled || busy) return;
    setError(null);
    setMode('confirmDelete');
    closeMenu(false);
  };

  const closeConfirm = () => {
    if (busy) return;
    setMode('idle');
    setError(null);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const handleConfirmDelete = async () => {
    if (busy || disabled) return;
    setBusy(true);
    setError(null);
    try {
      await onDelete();
      setMode('idle');
    } catch (err) {
      const message =
        err instanceof Error && /[ぁ-んァ-ン一-龥]/.test(err.message)
          ? err.message
          : '回答を削除できませんでした。時間をおいてもう一度試してください。';
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const trimmedTitle = itemTitle.trim() || 'この質問';

  return (
    <div className={styles.root}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        disabled={disabled || busy}
        aria-label={`「${trimmedTitle}」の回答操作`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? menuId : undefined}
        onClick={() => {
          if (disabled || busy) return;
          setMenuOpen((open) => !open);
          setFocusedIndex(0);
        }}
      >
        <span aria-hidden="true">…</span>
      </button>

      {menuOpen && position
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              className={styles.menu}
              style={{ top: position.top, left: position.left }}
              role="menu"
              aria-label={`「${trimmedTitle}」の回答操作メニュー`}
              tabIndex={-1}
              onKeyDown={handleMenuKeyDown}
            >
              {variant === 'answerAgain' ? (
                <button
                  type="button"
                  role="menuitem"
                  className={styles.menuItem}
                  tabIndex={0}
                  onClick={() => {
                    closeMenu(false);
                    onAnswerAgain?.();
                  }}
                >
                  もう一度答える
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.menuItem}
                    tabIndex={focusedIndex === 0 ? 0 : -1}
                    onMouseEnter={() => setFocusedIndex(0)}
                    onClick={handleRewrite}
                  >
                    書き直す
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={`${styles.menuItem} ${styles.menuItemDanger}`}
                    tabIndex={focusedIndex === 1 ? 0 : -1}
                    onMouseEnter={() => setFocusedIndex(1)}
                    onClick={handleOpenDelete}
                  >
                    回答を削除
                  </button>
                </>
              )}
            </div>,
            document.body,
          )
        : null}

      {mode === 'confirmDelete'
        ? createPortal(
            <div
              className={styles.overlay}
              onMouseDown={closeConfirm}
              role="presentation"
            >
              <div
                className={styles.dialog}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <h2 id={titleId} className={styles.dialogTitle}>
                  「{trimmedTitle}」への回答を削除しますか？
                </h2>
                <p className={styles.dialogBody}>
                  回答の文章は消えます。
                  <br />
                  獲得したHossiiとスタンプは残ります。
                  <br />
                  もう一度回答できますが、Hossiiは再付与されません。
                </p>
                {error ? (
                  <p className={styles.dialogError} role="alert">
                    {error}
                  </p>
                ) : null}
                <div className={styles.dialogActions}>
                  <button
                    type="button"
                    className={styles.cancelButton}
                    disabled={busy}
                    onClick={closeConfirm}
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    className={styles.deleteButton}
                    disabled={busy}
                    onClick={() => void handleConfirmDelete()}
                  >
                    {busy ? '削除中…' : '回答を削除'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
