import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './TagFilterPopover.module.css';

type Props = {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  activeTag: string | null;
  candidates: string[];
  tagCounts: Map<string, number>;
  onSelect: (tag: string | null) => void;
  onClose: () => void;
};

function computePosition(anchor: HTMLElement): { top: number; left: number } {
  const rect = anchor.getBoundingClientRect();
  const panelW = 200;
  let left = rect.right - panelW;
  left = Math.max(8, Math.min(left, window.innerWidth - panelW - 8));
  return { top: rect.bottom + 6, left };
}

function initialFocusedIndex(activeTag: string | null, candidates: string[]): number {
  if (!activeTag) return 0;
  const idx = candidates.indexOf(activeTag);
  return idx >= 0 ? idx + 1 : 0;
}

export function TagFilterPopover({
  open,
  anchorRef,
  activeTag,
  candidates,
  tagCounts,
  onSelect,
  onClose,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(() =>
    initialFocusedIndex(activeTag, candidates),
  );

  const itemCount = 1 + candidates.length;

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      setPosition(computePosition(anchor));
    };

    updatePosition();
    const frame = requestAnimationFrame(updatePosition);

    const anchor = anchorRef.current;
    const resizeObserver =
      anchor && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            requestAnimationFrame(updatePosition);
          })
        : null;
    if (anchor && resizeObserver) {
      resizeObserver.observe(anchor);
    }

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        anchorRef.current?.focus();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((i) => Math.min(i + 1, itemCount - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && focusedIndex >= 0) {
        e.preventDefault();
        if (focusedIndex === 0) onSelect(null);
        else onSelect(candidates[focusedIndex - 1] ?? null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, focusedIndex, itemCount, candidates, onSelect, onClose, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open, onClose, anchorRef]);

  if (!open || !position) return null;

  return createPortal(
    <div
      ref={panelRef}
      className={styles.panel}
      style={{ top: position.top, left: position.left }}
      role="listbox"
      aria-label="タグで絞り込む"
    >
      <button
        type="button"
        role="option"
        aria-selected={activeTag == null}
        className={`${styles.row} ${activeTag == null ? styles.rowSelected : ''} ${focusedIndex === 0 ? styles.rowFocused : ''}`}
        onClick={() => onSelect(null)}
      >
        {activeTag == null && <span className={styles.check} aria-hidden>✓</span>}
        <span className={styles.rowLabel}>すべて表示</span>
      </button>
      <div className={styles.divider} />
      {candidates.map((tag, idx) => {
        const selected = activeTag === tag;
        const focusIdx = idx + 1;
        return (
          <button
            key={tag}
            type="button"
            role="option"
            aria-selected={selected}
            className={`${styles.row} ${selected ? styles.rowSelected : ''} ${focusedIndex === focusIdx ? styles.rowFocused : ''}`}
            onClick={() => onSelect(tag)}
          >
            {selected && <span className={styles.check} aria-hidden>✓</span>}
            <span className={styles.rowLabel}>#{tag}</span>
            <span className={styles.count}>({tagCounts.get(tag) ?? 0}件)</span>
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
