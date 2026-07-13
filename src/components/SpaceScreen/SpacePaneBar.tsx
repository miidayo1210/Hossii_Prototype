import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type Ref,
  type RefObject,
} from 'react';
import type { SpacePane } from '../../core/types/spacePane';
import type { TabFolder } from '../../core/utils/tabFolderStorage';
import {
  canMovePaneToBasket,
  isPointInRect,
  resolvePaneFolderId,
  resolveInsertBeforeVisibleIndex,
  splitPanesByFolders,
} from '../../core/utils/spacePaneTabBar';
import { loadTabFolderOpen, resolveFolderInsertBeforeIndex, saveTabFolderOpen } from '../../core/utils/tabFolderStorage';
import styles from './SpacePaneBar.module.css';

const DRAG_THRESHOLD_PX = 6;
const LONG_PRESS_MS = 300;

type DropTarget =
  | { zone: 'bar'; insertBeforeIndex: number }
  | { zone: 'folder-chip'; folderId: string }
  | { zone: 'folder-tabs'; folderId: string; insertBeforeIndex: number };

type PersonalShortcut = {
  label: string;
  loading?: boolean;
  /** 現在このスペース（本人の個人スペース）を開いているとき true。active 表示に使う。 */
  active?: boolean;
  onClick: () => void;
};

type Props = {
  spaceId: string;
  /** Ordered list of folders to display (including default folder when applicable). */
  folders: TabFolder[];
  visiblePanes: SpacePane[];
  activePaneId: string | null;
  isAdmin: boolean;
  disabled?: boolean;
  variant: 'desktop' | 'mobile';
  onSelect: (paneId: string) => void;
  onAddPane?: () => void;
  /** Create a new folder; returns the new folder id for immediate inline rename. */
  onAddFolder?: () => string;
  onRenameFolder?: (folderId: string, name: string) => void;
  onDeleteFolder?: (folderId: string) => void;
  /** Reorder within the same strip ('bar' or a folderId). */
  onReorder?: (draggedId: string, insertBeforeIndex: number, stripId: string) => void;
  /** Move a pane to a folder (folderId) or back to bar (null). */
  onMoveToFolder?: (paneId: string, folderId: string | null, insertBeforeBarIndex?: number) => void;
  /** Reorder folder chips among themselves. */
  onReorderFolder?: (draggedId: string, insertBeforeIndex: number) => void;
  /** モバイルバーの DOM 参照（ヒント配置など） */
  rootRef?: Ref<HTMLElement>;
  /** 個人スペースへのショートカット（Pane ではなく UI ボタン） */
  personalShortcut?: PersonalShortcut | null;
};

type DragState = {
  paneId: string;
  sourceFolderId: string | null;
  pointerId: number;
  startX: number;
  startY: number;
  armed: boolean;
  dragging: boolean;
};

type FolderDragState = {
  folderId: string;
  pointerId: number;
  startX: number;
  startY: number;
  armed: boolean;
  dragging: boolean;
};

type FolderDropTarget = { insertBeforeIndex: number };

// ─── FolderChip sub-component ────────────────────────────────────────────────

function FolderChip({
  folder,
  count,
  isOpen,
  isDropTarget,
  isDragging,
  isDraggable,
  isEditing,
  disabled,
  isAdmin,
  chipRef,
  onToggle,
  onRenameStart,
  onRenameEnd,
  onDelete,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  folder: TabFolder;
  count: number;
  isOpen: boolean;
  isDropTarget: boolean;
  isDragging: boolean;
  isDraggable: boolean;
  isEditing: boolean;
  disabled: boolean;
  isAdmin: boolean;
  chipRef: (el: HTMLButtonElement | null) => void;
  onToggle: () => void;
  onRenameStart: () => void;
  onRenameEnd: (name: string) => void;
  onDelete: () => void;
  onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: () => void;
}) {
  const [editValue, setEditValue] = useState(folder.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync edit field when rename mode opens
      setEditValue(folder.name);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [isEditing, folder.name]);

  const commit = useCallback(() => {
    const trimmed = editValue.trim();
    onRenameEnd(trimmed || folder.name);
  }, [editValue, folder.name, onRenameEnd]);

  if (isEditing) {
    return (
      <div className={styles.folderChipEditing}>
        <span className={styles.folderIcon} aria-hidden>
          📁
        </span>
        <input
          ref={inputRef}
          className={styles.folderNameInput}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
            if (e.key === 'Escape') {
              onRenameEnd(folder.name);
            }
          }}
          maxLength={20}
        />
      </div>
    );
  }

  return (
    <div className={styles.folderChipWrapper}>
      <button
        ref={chipRef}
        type="button"
        className={`${styles.folderChip} ${isOpen ? styles.folderChipOpen : ''} ${
          isDropTarget ? styles.folderChipDropTarget : ''
        } ${isDragging ? styles.folderChipDragging : ''} ${
          isDraggable ? styles.folderChipDraggable : ''
        }`}
        aria-expanded={isOpen}
        aria-grabbed={isDragging}
        aria-label={`フォルダ「${folder.name}」${count > 0 ? `（${count}件）` : ''}`}
        disabled={disabled}
        onClick={onToggle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <span className={styles.folderIcon} aria-hidden>
          📁
        </span>
        <span className={styles.folderName}>{folder.name}</span>
        {count > 0 && <span className={styles.folderCount}>{count}</span>}
      </button>
      {isAdmin && (
        <div className={styles.folderActions}>
          <button
            type="button"
            className={styles.folderActionBtn}
            aria-label={`「${folder.name}」の名前を変更`}
            tabIndex={-1}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              onRenameStart();
            }}
          >
            ✏️
          </button>
          <button
            type="button"
            className={`${styles.folderActionBtn} ${styles.folderActionDelete}`}
            aria-label={`「${folder.name}」を削除`}
            tabIndex={-1}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

// ─── TabButton sub-component ─────────────────────────────────────────────────

function TabButton({
  pane,
  isActive,
  isDragging,
  canDrag,
  disabled,
  onSelect,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  setTabRef,
}: {
  pane: SpacePane;
  isActive: boolean;
  isDragging: boolean;
  canDrag: boolean;
  disabled: boolean;
  onSelect: () => void;
  onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: () => void;
  setTabRef: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      ref={setTabRef}
      type="button"
      role="tab"
      id={`space-pane-tab-${pane.id}`}
      aria-selected={isActive}
      aria-grabbed={isDragging}
      aria-controls="space-pane-panel"
      className={`${styles.tab} ${isActive ? styles.tabActive : ''} ${
        isDragging ? styles.tabDragging : ''
      } ${canDrag ? styles.tabDraggable : ''}`}
      disabled={disabled}
      title={pane.name}
      onClick={onSelect}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {pane.name}
    </button>
  );
}

// ─── SpacePaneBar ─────────────────────────────────────────────────────────────

export function SpacePaneBar({
  spaceId,
  folders,
  visiblePanes,
  activePaneId,
  isAdmin,
  disabled = false,
  variant,
  onSelect,
  onAddPane,
  onAddFolder,
  onRenameFolder,
  onDeleteFolder,
  onReorder,
  onMoveToFolder,
  onReorderFolder,
  rootRef,
  personalShortcut = null,
}: Props) {
  const { barPanes, folderMap } = useMemo(
    () => splitPanesByFolders(visiblePanes),
    [visiblePanes],
  );

  const canManageTabs = isAdmin && !disabled && (!!onReorder || !!onMoveToFolder);
  const canManageFolders = isAdmin && !disabled && !!onReorderFolder && folders.length > 1;

  // refs
  const barTabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const folderTabRefs = useRef<Map<string, HTMLButtonElement>>(new Map()); // paneId → el (flat)
  const folderChipRefs = useRef<Map<string, HTMLButtonElement>>(new Map()); // folderId → el
  const dragRef = useRef<DragState | null>(null);
  const folderDragRef = useRef<FolderDragState | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClickRef = useRef(false);

  // open/close state per folder
  const [openFolderIds, setOpenFolderIds] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const f of folders) {
      if (loadTabFolderOpen(spaceId, f.id)) s.add(f.id);
    }
    return s;
  });

  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [draggingPaneId, setDraggingPaneId] = useState<string | null>(null);
  const [folderDropTarget, setFolderDropTarget] = useState<FolderDropTarget | null>(null);
  const [draggingFolderId, setDraggingFolderId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);

  const barClass =
    variant === 'desktop'
      ? `${styles.spacePaneBar} ${styles.spacePaneBarDesktop}`
      : `${styles.spacePaneBar} ${styles.spacePaneBarMobile}`;

  // Sync open state when space changes
  useEffect(() => {
    const s = new Set<string>();
    for (const f of folders) {
      if (loadTabFolderOpen(spaceId, f.id)) s.add(f.id);
    }
    setOpenFolderIds(s);
    setEditingFolderId(null);
  }, [spaceId, folders]);

  // ── drag helpers ────────────────────────────────────────────────────────────

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const resetDrag = useCallback(() => {
    clearLongPressTimer();
    dragRef.current = null;
    folderDragRef.current = null;
    setDropTarget(null);
    setDraggingPaneId(null);
    setFolderDropTarget(null);
    setDraggingFolderId(null);
  }, [clearLongPressTimer]);

  const getFolderChipRects = useCallback((): Map<string, DOMRect> => {
    const rects = new Map<string, DOMRect>();
    for (const folder of folders) {
      const el = folderChipRefs.current.get(folder.id);
      if (el) rects.set(folder.id, el.getBoundingClientRect());
    }
    return rects;
  }, [folders]);

  const resolveFolderDropTarget = useCallback(
    (clientX: number): FolderDropTarget | null => {
      if (folders.length <= 1) return null;
      return {
        insertBeforeIndex: resolveFolderInsertBeforeIndex(
          folders,
          getFolderChipRects(),
          clientX,
        ),
      };
    },
    [folders, getFolderChipRects],
  );

  const getTabRects = useCallback(
    (panes: SpacePane[], refMap: Map<string, HTMLButtonElement>): Map<string, DOMRect> => {
      const rects = new Map<string, DOMRect>();
      for (const pane of panes) {
        const el = refMap.get(pane.id);
        if (el) rects.set(pane.id, el.getBoundingClientRect());
      }
      return rects;
    },
    [],
  );

  const resolveDropTarget = useCallback(
    (clientX: number, clientY: number, paneId: string): DropTarget | null => {
      const draggedPane = visiblePanes.find((p) => p.id === paneId);
      if (!draggedPane) return null;

      // Check open folder trays first
      for (const [folderId, panes] of folderMap) {
        if (!openFolderIds.has(folderId)) continue;
        for (const pane of panes) {
          const rect = folderTabRefs.current.get(pane.id)?.getBoundingClientRect();
          if (rect && isPointInRect(clientX, clientY, rect)) {
            return {
              zone: 'folder-tabs',
              folderId,
              insertBeforeIndex: resolveInsertBeforeVisibleIndex(
                panes,
                getTabRects(panes, folderTabRefs.current),
                clientX,
              ),
            };
          }
        }
      }

      // Check folder chips
      const sourceFolderId = resolvePaneFolderId(draggedPane);
      for (const folder of folders) {
        const chipRect = folderChipRefs.current.get(folder.id)?.getBoundingClientRect();
        if (
          chipRect &&
          isPointInRect(clientX, clientY, chipRect) &&
          canMovePaneToBasket(draggedPane)
        ) {
          return { zone: 'folder-chip', folderId: folder.id };
        }
      }

      // Check bar tabs
      for (const pane of barPanes) {
        const rect = barTabRefs.current.get(pane.id)?.getBoundingClientRect();
        if (rect && isPointInRect(clientX, clientY, rect)) {
          return {
            zone: 'bar',
            insertBeforeIndex: resolveInsertBeforeVisibleIndex(
              barPanes,
              getTabRects(barPanes, barTabRefs.current),
              clientX,
            ),
          };
        }
      }

      // Folder tab dropped past the bar → move to bar at end
      if (sourceFolderId !== null) {
        return { zone: 'bar', insertBeforeIndex: barPanes.length };
      }

      return null;
    },
    [barPanes, folderMap, folders, getTabRects, openFolderIds, visiblePanes],
  );

  const commitDrop = useCallback(
    (drag: DragState, target: DropTarget) => {
      const { paneId, sourceFolderId } = drag;

      if (target.zone === 'folder-chip') {
        if (sourceFolderId !== target.folderId) {
          onMoveToFolder?.(paneId, target.folderId);
        }
      } else if (target.zone === 'folder-tabs') {
        if (sourceFolderId === target.folderId) {
          onReorder?.(paneId, target.insertBeforeIndex, target.folderId);
        } else {
          // Cross-folder or bar→folder move
          onMoveToFolder?.(paneId, target.folderId);
        }
      } else if (target.zone === 'bar') {
        if (sourceFolderId !== null) {
          onMoveToFolder?.(paneId, null, target.insertBeforeIndex);
        } else {
          onReorder?.(paneId, target.insertBeforeIndex, 'bar');
        }
      }

      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    },
    [onMoveToFolder, onReorder],
  );

  const canDragPane = useCallback((): boolean => {
    if (!canManageTabs) return false;
    const totalPanes = barPanes.length + [...folderMap.values()].reduce((s, a) => s + a.length, 0);
    return totalPanes > 1;
  }, [barPanes.length, canManageTabs, folderMap]);

  const handlePointerDown = useCallback(
    (pane: SpacePane, event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!canDragPane() || event.button !== 0 || folderDragRef.current) return;

      clearLongPressTimer();
      dragRef.current = {
        paneId: pane.id,
        sourceFolderId: resolvePaneFolderId(pane),
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        armed: event.pointerType !== 'touch',
        dragging: false,
      };

      if (event.pointerType === 'touch') {
        longPressTimerRef.current = setTimeout(() => {
          const drag = dragRef.current;
          if (!drag || drag.paneId !== pane.id) return;
          drag.armed = true;
        }, LONG_PRESS_MS);
      }

      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [canDragPane, clearLongPressTimer],
  );

  const handlePointerMove = useCallback(
    (pane: SpacePane, event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.paneId !== pane.id || drag.pointerId !== event.pointerId) return;

      const dx = Math.abs(event.clientX - drag.startX);
      const dy = Math.abs(event.clientY - drag.startY);
      if (!drag.armed && (dx >= DRAG_THRESHOLD_PX || dy >= DRAG_THRESHOLD_PX)) {
        drag.armed = true;
        clearLongPressTimer();
      }

      if (!drag.armed) return;

      if (!drag.dragging) {
        drag.dragging = true;
        setDraggingPaneId(pane.id);
      }

      event.preventDefault();
      setDropTarget(resolveDropTarget(event.clientX, event.clientY, pane.id));
    },
    [clearLongPressTimer, resolveDropTarget],
  );

  const handlePointerUp = useCallback(
    (pane: SpacePane, event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      clearLongPressTimer();

      if (!drag || drag.paneId !== pane.id || drag.pointerId !== event.pointerId) {
        resetDrag();
        return;
      }

      if (drag.dragging) {
        const target = dropTarget ?? resolveDropTarget(event.clientX, event.clientY, pane.id);
        if (target) commitDrop(drag, target);
      }

      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }

      resetDrag();
    },
    [clearLongPressTimer, commitDrop, dropTarget, resetDrag, resolveDropTarget],
  );

  const handlePointerCancel = useCallback(() => resetDrag(), [resetDrag]);

  const handleFolderPointerDown = useCallback(
    (folder: TabFolder, event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!canManageFolders || event.button !== 0 || editingFolderId != null || dragRef.current) {
        return;
      }

      clearLongPressTimer();
      folderDragRef.current = {
        folderId: folder.id,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        armed: event.pointerType !== 'touch',
        dragging: false,
      };

      if (event.pointerType === 'touch') {
        longPressTimerRef.current = setTimeout(() => {
          const drag = folderDragRef.current;
          if (!drag || drag.folderId !== folder.id) return;
          drag.armed = true;
        }, LONG_PRESS_MS);
      }

      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [canManageFolders, clearLongPressTimer, editingFolderId],
  );

  const handleFolderPointerMove = useCallback(
    (folder: TabFolder, event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = folderDragRef.current;
      if (!drag || drag.folderId !== folder.id || drag.pointerId !== event.pointerId) return;

      const dx = Math.abs(event.clientX - drag.startX);
      const dy = Math.abs(event.clientY - drag.startY);
      if (!drag.armed && (dx >= DRAG_THRESHOLD_PX || dy >= DRAG_THRESHOLD_PX)) {
        drag.armed = true;
        clearLongPressTimer();
      }

      if (!drag.armed) return;

      if (!drag.dragging) {
        drag.dragging = true;
        setDraggingFolderId(folder.id);
      }

      event.preventDefault();
      setFolderDropTarget(resolveFolderDropTarget(event.clientX));
    },
    [clearLongPressTimer, resolveFolderDropTarget],
  );

  const handleFolderPointerUp = useCallback(
    (folder: TabFolder, event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = folderDragRef.current;
      clearLongPressTimer();

      if (!drag || drag.folderId !== folder.id || drag.pointerId !== event.pointerId) {
        resetDrag();
        return;
      }

      if (drag.dragging) {
        const target =
          folderDropTarget ?? resolveFolderDropTarget(event.clientX);
        if (target) {
          onReorderFolder?.(folder.id, target.insertBeforeIndex);
        }
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      }

      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }

      resetDrag();
    },
    [clearLongPressTimer, folderDropTarget, onReorderFolder, resetDrag, resolveFolderDropTarget],
  );

  const handleFolderPointerCancel = useCallback(() => resetDrag(), [resetDrag]);

  useEffect(() => resetDrag, [visiblePanes, folders, resetDrag]);

  const handleTabClick = useCallback(
    (paneId: string) => {
      if (suppressClickRef.current) return;
      onSelect(paneId);
    },
    [onSelect],
  );

  // ── folder open/close ───────────────────────────────────────────────────────

  const toggleFolder = useCallback(
    (folderId: string) => {
      if (suppressClickRef.current) return;
      setOpenFolderIds((prev) => {
        const next = new Set(prev);
        const open = !prev.has(folderId);
        if (open) next.add(folderId);
        else next.delete(folderId);
        saveTabFolderOpen(spaceId, folderId, open);
        return next;
      });
    },
    [spaceId],
  );

  // ── folder management ───────────────────────────────────────────────────────

  const handleAddFolderClick = useCallback(() => {
    const newId = onAddFolder?.();
    if (newId) {
      // Auto-open and start editing the new folder
      setOpenFolderIds((prev) => new Set([...prev, newId]));
      setEditingFolderId(newId);
    }
  }, [onAddFolder]);

  const handleRenameEnd = useCallback(
    (folderId: string, name: string) => {
      setEditingFolderId(null);
      onRenameFolder?.(folderId, name);
    },
    [onRenameFolder],
  );

  const handleDeleteFolder = useCallback(
    (folder: TabFolder) => {
      const paneCount = (folderMap.get(folder.id) ?? []).length;
      const confirmed =
        paneCount === 0 ||
        window.confirm(
          `「${folder.name}」を削除しますか？\n中のタブ（${paneCount}件）はバーに戻ります。`,
        );
      if (confirmed) onDeleteFolder?.(folder.id);
    },
    [folderMap, onDeleteFolder],
  );

  // ── render helpers ──────────────────────────────────────────────────────────

  const renderDropIndicator = (show: boolean) =>
    show ? <span className={styles.dropIndicator} aria-hidden /> : null;

  const makeTabProps = (pane: SpacePane, refMapRef: RefObject<Map<string, HTMLButtonElement>>) => ({
    pane,
    isActive: pane.id === activePaneId,
    isDragging: pane.id === draggingPaneId,
    canDrag: canDragPane(),
    disabled,
    onSelect: () => handleTabClick(pane.id),
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => handlePointerDown(pane, e),
    onPointerMove: (e: ReactPointerEvent<HTMLButtonElement>) => handlePointerMove(pane, e),
    onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => handlePointerUp(pane, e),
    onPointerCancel: handlePointerCancel,
    setTabRef: (el: HTMLButtonElement | null) => {
      const refMap = refMapRef.current;
      if (!refMap) return;
      if (el) refMap.set(pane.id, el);
      else refMap.delete(pane.id);
    },
  });

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <nav
      ref={rootRef}
      className={barClass}
      aria-label="スペース内タブ"
      data-space-export="exclude"
    >
      <div
        className={`${styles.scroll} ${
          draggingPaneId || draggingFolderId ? styles.scrollDragging : ''
        }`}
        role="tablist"
      >
        {/* Bar tabs */}
        {/* eslint-disable react-hooks/refs -- tab ref callbacks run on mount, not during render */}
        {barPanes.map((pane, index) => {
          const showIndicatorBefore =
            dropTarget?.zone === 'bar' && dropTarget.insertBeforeIndex === index;
          return (
            <div key={pane.id} className={styles.tabSlot}>
              {renderDropIndicator(showIndicatorBefore)}
              <TabButton {...makeTabProps(pane, barTabRefs)} />
            </div>
          );
        })}
        {/* eslint-enable react-hooks/refs */}
        {dropTarget?.zone === 'bar' &&
          dropTarget.insertBeforeIndex === barPanes.length &&
          draggingPaneId != null &&
          renderDropIndicator(true)}

        {/* Folder clusters */}
        {/* eslint-disable react-hooks/refs -- folder/tab ref callbacks run on mount, not during render */}
        {folders.map((folder, index) => {
          const folderPanes = folderMap.get(folder.id) ?? [];
          const isOpen = openFolderIds.has(folder.id);
          const isDropTarget =
            draggingPaneId != null &&
            dropTarget?.zone === 'folder-chip' &&
            dropTarget.folderId === folder.id;
          const showFolderIndicatorBefore =
            draggingFolderId != null &&
            folderDropTarget?.insertBeforeIndex === index;
          const trayVisible = isOpen && (folderPanes.length > 0 || draggingPaneId != null);

          return (
            <div key={folder.id} className={styles.folderCluster}>
              {renderDropIndicator(showFolderIndicatorBefore)}
              <FolderChip
                folder={folder}
                count={folderPanes.length}
                isOpen={isOpen}
                isDropTarget={isDropTarget}
                isDragging={folder.id === draggingFolderId}
                isDraggable={canManageFolders && editingFolderId !== folder.id}
                isEditing={editingFolderId === folder.id}
                disabled={disabled}
                isAdmin={isAdmin}
                chipRef={(el) => {
                  if (el) folderChipRefs.current.set(folder.id, el);
                  else folderChipRefs.current.delete(folder.id);
                }}
                onToggle={() => toggleFolder(folder.id)}
                onRenameStart={() => setEditingFolderId(folder.id)}
                onRenameEnd={(name) => handleRenameEnd(folder.id, name)}
                onDelete={() => handleDeleteFolder(folder)}
                onPointerDown={(e) => handleFolderPointerDown(folder, e)}
                onPointerMove={(e) => handleFolderPointerMove(folder, e)}
                onPointerUp={(e) => handleFolderPointerUp(folder, e)}
                onPointerCancel={handleFolderPointerCancel}
              />

              <div
                className={`${styles.folderTray} ${trayVisible ? styles.folderTrayOpen : ''}`}
                aria-hidden={!trayVisible}
              >
                {isOpen &&
                  folderPanes.map((pane, index) => {
                    const showIndicatorBefore =
                      dropTarget?.zone === 'folder-tabs' &&
                      dropTarget.folderId === folder.id &&
                      dropTarget.insertBeforeIndex === index;
                    return (
                      <div key={pane.id} className={styles.tabSlot}>
                        {renderDropIndicator(showIndicatorBefore)}
                        <TabButton {...makeTabProps(pane, folderTabRefs)} />
                      </div>
                    );
                  })}
                {dropTarget?.zone === 'folder-tabs' &&
                  dropTarget.folderId === folder.id &&
                  dropTarget.insertBeforeIndex === folderPanes.length &&
                  draggingPaneId != null &&
                  renderDropIndicator(true)}
              </div>
            </div>
          );
        })}
        {/* eslint-enable react-hooks/refs */}
        {draggingFolderId != null &&
          folderDropTarget?.insertBeforeIndex === folders.length &&
          renderDropIndicator(true)}

        {/* Add folder button (admin only) */}
        {isAdmin && onAddFolder && (
          <button
            type="button"
            className={styles.addFolderButton}
            aria-label="フォルダを追加"
            disabled={disabled}
            onClick={handleAddFolderClick}
          >
            📁＋
          </button>
        )}

        {/* Add pane button (admin only) */}
        {isAdmin && onAddPane && (
          <button
            type="button"
            className={styles.addButton}
            aria-label="タブを追加"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              onAddPane();
            }}
          >
            ＋
          </button>
        )}

        {personalShortcut && (
          <button
            type="button"
            role="tab"
            aria-selected={!!personalShortcut.active}
            aria-label={
              personalShortcut.active
                ? '自分の個人スペースを表示中'
                : '自分の個人スペースを開く'
            }
            className={`${styles.personalShortcut} ${
              personalShortcut.active ? styles.personalShortcutActive : ''
            }`}
            disabled={disabled || personalShortcut.loading}
            onClick={(e) => {
              e.stopPropagation();
              personalShortcut.onClick();
            }}
          >
            {personalShortcut.loading ? '…' : personalShortcut.label}
          </button>
        )}
      </div>
    </nav>
  );
}
