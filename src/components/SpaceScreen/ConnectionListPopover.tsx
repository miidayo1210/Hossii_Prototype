import { createPortal } from 'react-dom';
import { useLayoutEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import styles from './ConnectionListPopover.module.css';
import { escapeDataAttributeSelectorValue } from '../../core/utils/escapeDataAttributeSelectorValue';

const GAP = 10;
const WIDTH = 260;

function clampHorizontal(left: number, width: number): number {
  return Math.max(8, Math.min(left, window.innerWidth - width - 8));
}

export type ConnectionListPopoverItem = {
  connectionId: string;
  peerHossiiId: string;
  messagePreview: string;
  strengthLabel: string;
};

type Props = {
  anchorHossiiId: string;
  items: ConnectionListPopoverItem[];
  onSelectPeer: (peerHossiiId: string) => void;
};

function useHossiiAnchorRect(hossiiId: string | null, active: boolean): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    if (!active || !hossiiId) {
      queueMicrotask(() => setRect(null));
      return;
    }

    const el = document.querySelector(
      `[data-hossii-id="${escapeDataAttributeSelectorValue(hossiiId)}"]`,
    );
    queueMicrotask(() => {
      setRect(el ? el.getBoundingClientRect() : null);
    });
  }, [active, hossiiId]);

  return rect;
}

export function ConnectionListPopover({ anchorHossiiId, items, onSelectPeer }: Props) {
  const anchorRect = useHossiiAnchorRect(anchorHossiiId, items.length > 0);

  if (!anchorRect || items.length === 0) return null;

  const centerX = anchorRect.left + anchorRect.width / 2;
  const left = clampHorizontal(centerX - WIDTH / 2, WIDTH);
  const style: CSSProperties = {
    position: 'fixed',
    left,
    width: WIDTH,
    bottom: window.innerHeight - anchorRect.top + GAP,
    zIndex: 325,
  };

  return createPortal(
    <div
      className={`${styles.popover} hossii-pop`}
      style={style}
      data-connection-list-popover
      data-space-export="exclude"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <p className={styles.title}>つながり {items.length}</p>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.connectionId}>
            <button
              type="button"
              className={styles.listItem}
              onClick={() => onSelectPeer(item.peerHossiiId)}
            >
              <span className={styles.messagePreview}>{item.messagePreview}</span>
              <span className={styles.strengthLabel}>{item.strengthLabel}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>,
    document.body,
  );
}
