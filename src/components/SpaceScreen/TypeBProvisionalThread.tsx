import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { buildConnectionPath } from '../../core/utils/connectionPath';
import {
  domRectToAxisRect,
  getBubbleConnectionPoint,
  rectCenter,
  toLocalPoint,
  type Point2D,
} from '../../core/utils/connectionEdgePoint';
import {
  buildTypeBProvisionalTargetRect,
  readBubbleHintsFromElement,
} from './typeBProvisionalThreadGeometry';
import styles from './TypeBProvisionalThread.module.css';

type Props = {
  bubbleAreaRef: React.RefObject<HTMLElement | null>;
  originHossiiId: string;
  positionX: number;
  positionY: number;
};

function escapeSelectorValue(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function findBubbleElement(root: HTMLElement, hossiiId: string): HTMLElement | null {
  return root.querySelector(`[data-hossii-id="${escapeSelectorValue(hossiiId)}"]`);
}

function percentToLocalPoint(areaRect: DOMRect, xPercent: number, yPercent: number): Point2D {
  return {
    x: (xPercent / 100) * areaRect.width,
    y: (yPercent / 100) * areaRect.height,
  };
}

function computeProvisionalEndpoints(
  bubbleArea: HTMLElement,
  originId: string,
  positionX: number,
  positionY: number,
): { from: Point2D; to: Point2D } | null {
  const areaRect = bubbleArea.getBoundingClientRect();
  const originEl = findBubbleElement(bubbleArea, originId);
  if (!originEl) return null;

  const targetCenterGlobal = {
    x: areaRect.left + (positionX / 100) * areaRect.width,
    y: areaRect.top + (positionY / 100) * areaRect.height,
  };

  const originRect = domRectToAxisRect(originEl.getBoundingClientRect());
  const originCenter = rectCenter(originRect);
  const fromGlobal = getBubbleConnectionPoint(
    originRect,
    readBubbleHintsFromElement(originEl),
    targetCenterGlobal,
  );

  const targetLocal = percentToLocalPoint(areaRect, positionX, positionY);
  const fromLocal = toLocalPoint(fromGlobal, areaRect);

  const pseudoTargetRect = buildTypeBProvisionalTargetRect(targetLocal);
  const toGlobal = getBubbleConnectionPoint(
    pseudoTargetRect,
    { hasLikeBadge: false, hasOwnerBar: false },
    originCenter,
  );
  const toLocal = toLocalPoint(toGlobal, areaRect);

  return { from: fromLocal, to: toLocal };
}

/** composing 中のみ: 起点 Bubble から新規位置候補へ dashed 仮糸を描画（click 不可） */
export function TypeBProvisionalThread({
  bubbleAreaRef,
  originHossiiId,
  positionX,
  positionY,
}: Props) {
  const pathRef = useRef<SVGPathElement | null>(null);
  const visibleRef = useRef(false);

  const updatePath = useCallback(() => {
    const bubbleArea = bubbleAreaRef.current;
    const pathEl = pathRef.current;
    if (!bubbleArea || !pathEl) {
      return;
    }

    const endpoints = computeProvisionalEndpoints(
      bubbleArea,
      originHossiiId,
      positionX,
      positionY,
    );
    if (!endpoints) {
      pathEl.style.visibility = 'hidden';
      visibleRef.current = false;
      return;
    }

    pathEl.setAttribute('d', buildConnectionPath(endpoints.from, endpoints.to, 'medium'));
    pathEl.style.visibility = 'visible';
    visibleRef.current = true;
  }, [bubbleAreaRef, originHossiiId, positionX, positionY]);

  useLayoutEffect(() => {
    updatePath();
  }, [updatePath]);

  useEffect(() => {
    const bubbleArea = bubbleAreaRef.current;
    if (!bubbleArea) return;

    const ro = new ResizeObserver(() => updatePath());
    ro.observe(bubbleArea);
    window.addEventListener('resize', updatePath);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updatePath);
    };
  }, [bubbleAreaRef, updatePath]);

  return (
    <div
      className={styles.overlay}
      data-type-b-provisional-thread
      data-space-export="exclude"
      aria-hidden
    >
      <svg className={styles.svg} aria-hidden>
        <path
          ref={pathRef}
          className={styles.dashedPath}
          style={{ visibility: 'hidden' }}
        />
      </svg>
    </div>
  );
}
