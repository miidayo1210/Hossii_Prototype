import { useCallback, useEffect, useRef } from 'react';
import type { HossiiConnection } from '../../core/types/hossiiConnection';
import {
  domRectToAxisRect,
  getBubbleConnectionPoint,
  rectCenter,
  toLocalPoint,
  type Point2D,
} from '../../core/utils/connectionEdgePoint';
import { buildConnectionPath } from '../../core/utils/connectionPath';
import type { BubbleAnchorHints } from '../../core/utils/connectionAnchorPadding';

export type ConnectionPathRefs = {
  visual: SVGPathElement;
  hit: SVGPathElement;
};

function readBubbleHints(el: HTMLElement): BubbleAnchorHints {
  return {
    hasLikeBadge: el.querySelector('[data-like-badge]') != null,
    hasOwnerBar: el.querySelector('[data-owner-actions]') != null,
  };
}

function escapeSelectorValue(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function findBubbleElement(root: HTMLElement, hossiiId: string): HTMLElement | null {
  return root.querySelector(`[data-hossii-id="${escapeSelectorValue(hossiiId)}"]`);
}

function computeEndpoints(
  bubbleArea: HTMLElement,
  sourceId: string,
  targetId: string,
): { from: Point2D; to: Point2D } | null {
  const areaRect = bubbleArea.getBoundingClientRect();
  const sourceEl = findBubbleElement(bubbleArea, sourceId);
  const targetEl = findBubbleElement(bubbleArea, targetId);
  if (!sourceEl || !targetEl) return null;

  const sourceRect = domRectToAxisRect(sourceEl.getBoundingClientRect());
  const targetRect = domRectToAxisRect(targetEl.getBoundingClientRect());
  const targetCenter = rectCenter(targetRect);
  const sourceCenter = rectCenter(sourceRect);

  const fromGlobal = getBubbleConnectionPoint(
    sourceRect,
    readBubbleHints(sourceEl),
    targetCenter,
  );
  const toGlobal = getBubbleConnectionPoint(
    targetRect,
    readBubbleHints(targetEl),
    sourceCenter,
  );

  return {
    from: toLocalPoint(fromGlobal, areaRect),
    to: toLocalPoint(toGlobal, areaRect),
  };
}

type UseConnectionOverlayGeometryOptions = {
  bubbleAreaRef: React.RefObject<HTMLElement | null>;
  connections: HossiiConnection[];
  enabled: boolean;
  pathRegistryRef: React.MutableRefObject<Map<string, ConnectionPathRefs>>;
};

/** rAF + ResizeObserver で path を直接更新（React state は使わない） */
export function useConnectionOverlayGeometry({
  bubbleAreaRef,
  connections,
  enabled,
  pathRegistryRef,
}: UseConnectionOverlayGeometryOptions): void {
  const connectionsRef = useRef(connections);
  connectionsRef.current = connections;

  const syncPaths = useCallback(() => {
    const bubbleArea = bubbleAreaRef.current;
    if (!bubbleArea || !enabled) return;

    for (const connection of connectionsRef.current) {
      const refs = pathRegistryRef.current.get(connection.id);
      if (!refs) continue;

      const endpoints = computeEndpoints(
        bubbleArea,
        connection.sourceHossiiId,
        connection.targetHossiiId,
      );
      if (!endpoints) {
        refs.visual.setAttribute('d', '');
        refs.hit.setAttribute('d', '');
        continue;
      }

      const pathD = buildConnectionPath(endpoints.from, endpoints.to, connection.strength);
      refs.visual.setAttribute('d', pathD);
      refs.hit.setAttribute('d', pathD);
    }
  }, [bubbleAreaRef, enabled, pathRegistryRef]);

  useEffect(() => {
    if (!enabled) return undefined;

    let rafId = 0;
    const tick = () => {
      syncPaths();
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    const bubbleArea = bubbleAreaRef.current;
    let resizeObserver: ResizeObserver | undefined;
    if (bubbleArea && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        syncPaths();
      });
      resizeObserver.observe(bubbleArea);
    }

    const handleWindowChange = () => syncPaths();
    window.addEventListener('resize', handleWindowChange);
    window.addEventListener('scroll', handleWindowChange, true);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', handleWindowChange);
      window.removeEventListener('scroll', handleWindowChange, true);
    };
  }, [bubbleAreaRef, enabled, syncPaths]);
}

export { computeEndpoints, readBubbleHints };
