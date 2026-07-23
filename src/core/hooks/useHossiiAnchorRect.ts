import { useLayoutEffect, useState } from 'react';
import { escapeDataAttributeSelectorValue } from '../utils/escapeDataAttributeSelectorValue';
import type { ConnectionPopoverViewport } from '../utils/connectionPopoverPosition';

export function useHossiiAnchorRect(
  hossiiId: string | null,
  active: boolean,
  viewport?: ConnectionPopoverViewport,
): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    if (!active || !hossiiId) {
      queueMicrotask(() => setRect(null));
      return;
    }

    const measure = () => {
      const el = document.querySelector(
        `[data-hossii-id="${escapeDataAttributeSelectorValue(hossiiId)}"]`,
      );
      setRect(el ? el.getBoundingClientRect() : null);
    };

    queueMicrotask(measure);
  }, [
    active,
    hossiiId,
    viewport?.height,
    viewport?.width,
    viewport?.offsetTop,
    viewport?.offsetLeft,
  ]);

  return rect;
}
