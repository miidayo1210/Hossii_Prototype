import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { SpacePane } from '../../core/types/spacePane';
import type { TabBarGroup } from '../../core/types/spacePaneTabBar';
import {
  canMovePaneToBasket,
  isPointInRect,
  resolveInsertBeforeVisibleIndex,
  resolveTabBarGroup,
  splitPanesByTabBarGroup,
} from '../../core/utils/spacePaneTabBar';
import { loadTabBasketOpen, saveTabBasketOpen } from '../../core/utils/tabBasketOpenStorage';
import styles from './SpacePaneBar.module.css';

const DRAG_THRESHOLD_PX = 6;
const LONG_PRESS_MS = 300;

type DropTarget =
  | { zone: 'bar'; insertBeforeIndex: number }
  | { zone: 'basket-chip' }
  | { zone: 'basket-tabs'; insertBeforeIndex: number };

type Props = {
  spaceId: string;
  visiblePanes: SpacePane[];
  activePaneId: string | null;
  isAdmin: boolean;
  disabled?: boolean;
  variant: 'desktop' | 'mobile';
  onSelect: (paneId: string) => void;
  onAddPane?: () => void;
  onReorder?: (draggedId: string, insertBeforeIndex: number, group: TabBarGroup) => void;
  onMoveTabBarGroup?: (
    paneId: string,
    group: TabBarGroup,
    insertBeforeBarIndex?: number,
  ) => void;
};

type DragState = {
  paneId: string;
  sourceGroup: TabBarGroup;
  pointerId: number;
  startX: number;
  startY: number;
  armed: boolean;
  dragging: boolean;
};

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

export function SpacePaneBar({
  spaceId,
  visiblePanes,
  activePaneId,
  isAdmin,
  disabled = false,
  variant,
  onSelect,
  onAddPane,
  onReorder,
  onMoveTabBarGroup,
}: Props) {
  const { barPanes, basketPanes } = useMemo(
    () => splitPanesByTabBarGroup(visiblePanes),
    [visiblePanes],
  );

  const showBasket = isAdmin || basketPanes.length > 0;
  const canManageTabs = isAdmin && !disabled && (!!onReorder || !!onMoveTabBarGroup);

  const barTabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const basketTabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const basketChipRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClickRef = useRef(false);

  const [basketOpen, setBasketOpen] = useState(() => loadTabBasketOpen(spaceId));
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [draggingPaneId, setDraggingPaneId] = useState<string | null>(null);

  const barClass =
    variant === 'desktop'
      ? `${styles.spacePaneBar} ${styles.spacePaneBarDesktop}`
      : `${styles.spacePaneBar} ${styles.spacePaneBarMobile}`;

  useEffect(() => {
    setBasketOpen(loadTabBasketOpen(spaceId));
  }, [spaceId]);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const resetDrag = useCallback(() => {
    clearLongPressTimer();
    dragRef.current = null;
    setDropTarget(null);
    setDraggingPaneId(null);
  }, [clearLongPressTimer]);

  const getBarTabRects = useCallback((): Map<string, DOMRect> => {
    const rects = new Map<string, DOMRect>();
    for (const pane of barPanes) {
      const el = barTabRefs.current.get(pane.id);
      if (el) rects.set(pane.id, el.getBoundingClientRect());
    }
    return rects;
  }, [barPanes]);

  const getBasketTabRects = useCallback((): Map<string, DOMRect> => {
    const rects = new Map<string, DOMRect>();
    for (const pane of basketPanes) {
      const el = basketTabRefs.current.get(pane.id);
      if (el) rects.set(pane.id, el.getBoundingClientRect());
    }
    return rects;
  }, [basketPanes]);

  const resolveDropTarget = useCallback(
    (clientX: number, clientY: number, draggedPaneId: string): DropTarget | null => {
      const draggedPane = visiblePanes.find((p) => p.id === draggedPaneId);
      if (!draggedPane) return null;
      const sourceGroup = resolveTabBarGroup(draggedPane);

      if (basketOpen) {
        for (const pane of basketPanes) {
          const rect = basketTabRefs.current.get(pane.id)?.getBoundingClientRect();
          if (rect && isPointInRect(clientX, clientY, rect)) {
            return {
              zone: 'basket-tabs',
              insertBeforeIndex: resolveInsertBeforeVisibleIndex(
                basketPanes,
                getBasketTabRects(),
                clientX,
              ),
            };
          }
        }
      }

      const chipRect = basketChipRef.current?.getBoundingClientRect();
      if (
        showBasket &&
        chipRect &&
        isPointInRect(clientX, clientY, chipRect) &&
        sourceGroup === 'bar' &&
        canMovePaneToBasket(draggedPane)
      ) {
        return { zone: 'basket-chip' };
      }

      for (const pane of barPanes) {
        const rect = barTabRefs.current.get(pane.id)?.getBoundingClientRect();
        if (rect && isPointInRect(clientX, clientY, rect)) {
          return {
            zone: 'bar',
            insertBeforeIndex: resolveInsertBeforeVisibleIndex(
              barPanes,
              getBarTabRects(),
              clientX,
            ),
          };
        }
      }

      if (sourceGroup === 'basket') {
        const scrollRect = basketChipRef.current?.parentElement?.getBoundingClientRect();
        if (scrollRect && clientX > (chipRect?.right ?? scrollRect.left)) {
          return { zone: 'bar', insertBeforeIndex: barPanes.length };
        }
      }

      return null;
    },
    [
      barPanes,
      basketOpen,
      basketPanes,
      getBarTabRects,
      getBasketTabRects,
      showBasket,
      visiblePanes,
    ],
  );

  const commitDrop = useCallback(
    (drag: DragState, target: DropTarget) => {
      const { paneId, sourceGroup } = drag;

      if (target.zone === 'basket-chip') {
        onMoveTabBarGroup?.(paneId, 'basket');
      } else if (target.zone === 'basket-tabs') {
        if (sourceGroup === 'basket') {
          onReorder?.(paneId, target.insertBeforeIndex, 'basket');
        }
      } else if (target.zone === 'bar') {
        if (sourceGroup === 'basket') {
          onMoveTabBarGroup?.(paneId, 'bar', target.insertBeforeIndex);
        } else {
          onReorder?.(paneId, target.insertBeforeIndex, 'bar');
        }
      }

      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    },
    [onMoveTabBarGroup, onReorder],
  );

  const canDragPane = useCallback(
    (pane: SpacePane) => {
      if (!canManageTabs) return false;
      const group = resolveTabBarGroup(pane);
      if (group === 'bar') return barPanes.length > 1 || basketPanes.length > 0;
      return basketPanes.length > 1 || barPanes.length > 0;
    },
    [barPanes.length, basketPanes.length, canManageTabs],
  );

  const handlePointerDown = useCallback(
    (pane: SpacePane, event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!canDragPane(pane) || event.button !== 0) return;

      clearLongPressTimer();
      dragRef.current = {
        paneId: pane.id,
        sourceGroup: resolveTabBarGroup(pane),
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

      const deltaX = Math.abs(event.clientX - drag.startX);
      const deltaY = Math.abs(event.clientY - drag.startY);
      if (!drag.armed && (deltaX >= DRAG_THRESHOLD_PX || deltaY >= DRAG_THRESHOLD_PX)) {
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
        const target =
          dropTarget ?? resolveDropTarget(event.clientX, event.clientY, pane.id);
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

  const handlePointerCancel = useCallback(() => {
    resetDrag();
  }, [resetDrag]);

  useEffect(() => resetDrag, [visiblePanes, resetDrag]);

  const handleTabClick = useCallback(
    (paneId: string) => {
      if (suppressClickRef.current) return;
      onSelect(paneId);
    },
    [onSelect],
  );

  const toggleBasket = useCallback(() => {
    setBasketOpen((open) => {
      const next = !open;
      saveTabBasketOpen(spaceId, next);
      return next;
    });
  }, [spaceId]);

  const handleBasketChipClick = useCallback(() => {
    if (suppressClickRef.current) return;
    toggleBasket();
  }, [toggleBasket]);

  const renderDropIndicator = (show: boolean) =>
    show ? <span className={styles.dropIndicator} aria-hidden /> : null;

  const basketDropActive = dropTarget?.zone === 'basket-chip';
  const basketTrayOpen = basketOpen && (basketPanes.length > 0 || draggingPaneId != null);

  return (
    <nav
      className={barClass}
      aria-label="スペース内タブ"
      data-space-export="exclude"
    >
      <div
        className={`${styles.scroll} ${draggingPaneId ? styles.scrollDragging : ''}`}
        role="tablist"
      >
        {barPanes.map((pane, index) => {
          const isActive = pane.id === activePaneId;
          const isDragging = pane.id === draggingPaneId;
          const showIndicatorBefore =
            dropTarget?.zone === 'bar' && dropTarget.insertBeforeIndex === index;

          return (
            <div key={pane.id} className={styles.tabSlot}>
              {renderDropIndicator(showIndicatorBefore)}
              <TabButton
                pane={pane}
                isActive={isActive}
                isDragging={isDragging}
                canDrag={canDragPane(pane)}
                disabled={disabled}
                onSelect={() => handleTabClick(pane.id)}
                onPointerDown={(e) => handlePointerDown(pane, e)}
                onPointerMove={(e) => handlePointerMove(pane, e)}
                onPointerUp={(e) => handlePointerUp(pane, e)}
                onPointerCancel={handlePointerCancel}
                setTabRef={(el) => {
                  if (el) barTabRefs.current.set(pane.id, el);
                  else barTabRefs.current.delete(pane.id);
                }}
              />
            </div>
          );
        })}
        {dropTarget?.zone === 'bar' &&
          dropTarget.insertBeforeIndex === barPanes.length &&
          draggingPaneId != null &&
          renderDropIndicator(true)}

        {showBasket && (
          <>
            <div className={styles.basketCluster}>
              <button
                ref={basketChipRef}
                type="button"
                className={`${styles.basketChip} ${basketOpen ? styles.basketChipOpen : ''} ${
                  basketDropActive ? styles.basketChipDropTarget : ''
                }`}
                aria-label={`タブカゴ${basketPanes.length > 0 ? `（${basketPanes.length}件）` : ''}`}
                aria-expanded={basketOpen}
                disabled={disabled}
                onClick={handleBasketChipClick}
              >
                <span className={styles.basketIcon} aria-hidden>
                  🧺
                </span>
                {basketPanes.length > 0 && (
                  <span className={styles.basketCount}>{basketPanes.length}</span>
                )}
              </button>

              <div
                className={`${styles.basketTray} ${basketTrayOpen ? styles.basketTrayOpen : ''}`}
                aria-hidden={!basketTrayOpen}
              >
                {basketOpen &&
                  basketPanes.map((pane, index) => {
                    const isActive = pane.id === activePaneId;
                    const isDragging = pane.id === draggingPaneId;
                    const showIndicatorBefore =
                      dropTarget?.zone === 'basket-tabs' &&
                      dropTarget.insertBeforeIndex === index;

                    return (
                      <div key={pane.id} className={styles.tabSlot}>
                        {renderDropIndicator(showIndicatorBefore)}
                        <TabButton
                          pane={pane}
                          isActive={isActive}
                          isDragging={isDragging}
                          canDrag={canDragPane(pane)}
                          disabled={disabled}
                          onSelect={() => handleTabClick(pane.id)}
                          onPointerDown={(e) => handlePointerDown(pane, e)}
                          onPointerMove={(e) => handlePointerMove(pane, e)}
                          onPointerUp={(e) => handlePointerUp(pane, e)}
                          onPointerCancel={handlePointerCancel}
                          setTabRef={(el) => {
                            if (el) basketTabRefs.current.set(pane.id, el);
                            else basketTabRefs.current.delete(pane.id);
                          }}
                        />
                      </div>
                    );
                  })}
                {dropTarget?.zone === 'basket-tabs' &&
                  dropTarget.insertBeforeIndex === basketPanes.length &&
                  draggingPaneId != null &&
                  renderDropIndicator(true)}
              </div>
            </div>
          </>
        )}

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
      </div>
    </nav>
  );
}
