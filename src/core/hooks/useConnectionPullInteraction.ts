import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import {
  clampPullVector,
  computeConnectedBubbleShift,
  computeDistance,
  computeDragVector,
  computeNormalizedProgress,
  computePullGlowProgress,
  computeTwoHopStarParticleCount,
  DEFAULT_MAX_PULL_DISTANCE_PX,
  type Point2D,
} from '../utils/connectionPullMath';
import { CONNECTION_PULL_CSS_VARS as CSS } from '../utils/connectionPullCssVars';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

export type ConnectionPullPhase = 'idle' | 'pulling';

/** 統合側が disabled 理由を型で共有するための union（hook は参照しない） */
export type ConnectionPullDisabledReason =
  | 'connectionsDisabled'
  | 'pickingTarget'
  | 'pickingStrength'
  | 'saving'
  | 'bubbleDragging'
  | 'bubbleResizing'
  | 'touchPointer'
  | 'other';

export type UseConnectionPullInteractionOptions = {
  sourceRef: RefObject<HTMLElement | null>;
  connectedRef?: RefObject<HTMLElement | null>;
  /** 複数接続先へ同一 shift を適用する統合向け ref */
  connectedElementsRef?: RefObject<readonly HTMLElement[]>;
  /** false 時は pointerdown 無効。pull 中に false へ変わったら即 reset */
  enabled?: boolean;
  /** 統合側のデバッグ・ログ用（hook ロジックには不使用） */
  disabledReason?: ConnectionPullDisabledReason;
  maxPullDistance?: number;
};

export type ConnectionPullInteractionHandlers = {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
};

export type UseConnectionPullInteractionResult = {
  phase: ConnectionPullPhase;
  /** overlay hit path 無効化・Bubble drag 排他に使用 */
  isPulling: boolean;
  handlers: ConnectionPullInteractionHandlers;
  starParticleCount: 1 | 2 | 3;
};

function getConnectedElements(
  connectedRef: RefObject<HTMLElement | null> | undefined,
  connectedElementsRef: RefObject<readonly HTMLElement[]> | undefined,
): readonly HTMLElement[] {
  if (connectedElementsRef?.current?.length) {
    return connectedElementsRef.current;
  }
  return connectedRef?.current ? [connectedRef.current] : [];
}

function applyPullCssVars(
  source: HTMLElement,
  connectedElements: readonly HTMLElement[],
  pullVector: Point2D,
  progress: number,
  reducedMotion: boolean,
): 1 | 2 | 3 {
  const glow = computePullGlowProgress(progress, reducedMotion);
  const shift = computeConnectedBubbleShift(pullVector, progress, { reducedMotion });
  const starCount = computeTwoHopStarParticleCount(progress, reducedMotion);

  source.style.setProperty(CSS.pullX, `${pullVector.x}px`);
  source.style.setProperty(CSS.pullY, `${pullVector.y}px`);
  source.style.setProperty(CSS.pullProgress, String(progress));
  source.style.setProperty(CSS.glowProgress, String(glow));
  source.dataset.reducedMotion = reducedMotion ? 'true' : 'false';
  source.dataset.connectionPullSource = 'true';

  for (const connected of connectedElements) {
    connected.style.setProperty(CSS.connectedShiftX, `${shift.x}px`);
    connected.style.setProperty(CSS.connectedShiftY, `${shift.y}px`);
    connected.dataset.connectionPullPeer = 'true';
  }

  return starCount;
}

function clearPullCssVars(
  source: HTMLElement | null,
  connectedElements: readonly HTMLElement[],
): void {
  if (source) {
    source.style.setProperty(CSS.pullX, '0px');
    source.style.setProperty(CSS.pullY, '0px');
    source.style.setProperty(CSS.pullProgress, '0');
    source.style.setProperty(CSS.glowProgress, '0');
    delete source.dataset.reducedMotion;
    delete source.dataset.connectionPullSource;
  }
  for (const connected of connectedElements) {
    connected.style.setProperty(CSS.connectedShiftX, '0px');
    connected.style.setProperty(CSS.connectedShiftY, '0px');
    delete connected.dataset.connectionPullPeer;
  }
}

export function useConnectionPullInteraction({
  sourceRef,
  connectedRef,
  connectedElementsRef,
  enabled = true,
  maxPullDistance = DEFAULT_MAX_PULL_DISTANCE_PX,
}: UseConnectionPullInteractionOptions): UseConnectionPullInteractionResult {
  const prefersReducedMotion = usePrefersReducedMotion();
  const phaseRef = useRef<ConnectionPullPhase>('idle');
  const [phase, setPhase] = useState<ConnectionPullPhase>('idle');
  const [starParticleCount, setStarParticleCount] = useState<1 | 2 | 3>(1);

  const originRef = useRef<Point2D>({ x: 0, y: 0 });
  const pullVectorRef = useRef<Point2D>({ x: 0, y: 0 });
  const pointerIdRef = useRef<number | null>(null);
  const captureTargetRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const starCountRef = useRef<1 | 2 | 3>(1);

  const setPhaseIfChanged = useCallback((next: ConnectionPullPhase) => {
    if (phaseRef.current === next) return;
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const syncStarCountIfChanged = useCallback((next: 1 | 2 | 3) => {
    if (starCountRef.current === next) return;
    starCountRef.current = next;
    setStarParticleCount(next);
  }, []);

  const flushCssVars = useCallback(() => {
    const source = sourceRef.current;
    if (!source) return;
    const distance = computeDistance(pullVectorRef.current);
    const progress = computeNormalizedProgress(distance, maxPullDistance);
    const nextStars = applyPullCssVars(
      source,
      getConnectedElements(connectedRef, connectedElementsRef),
      pullVectorRef.current,
      progress,
      prefersReducedMotion,
    );
    syncStarCountIfChanged(nextStars);
  }, [connectedElementsRef, connectedRef, maxPullDistance, prefersReducedMotion, sourceRef, syncStarCountIfChanged]);

  const scheduleFlush = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      flushCssVars();
    });
  }, [flushCssVars]);

  const releaseCapture = useCallback(() => {
    const target = captureTargetRef.current;
    const pointerId = pointerIdRef.current;
    if (target != null && pointerId != null && target.hasPointerCapture(pointerId)) {
      target.releasePointerCapture(pointerId);
    }
    captureTargetRef.current = null;
    pointerIdRef.current = null;
  }, []);

  const resetPull = useCallback(() => {
    pullVectorRef.current = { x: 0, y: 0 };
    clearPullCssVars(
      sourceRef.current,
      getConnectedElements(connectedRef, connectedElementsRef),
    );
    syncStarCountIfChanged(1);
    setPhaseIfChanged('idle');
    releaseCapture();
  }, [connectedElementsRef, connectedRef, releaseCapture, setPhaseIfChanged, sourceRef, syncStarCountIfChanged]);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (phaseRef.current !== 'pulling' || event.pointerId !== pointerIdRef.current) return;
      const raw = computeDragVector(originRef.current, {
        x: event.clientX,
        y: event.clientY,
      });
      pullVectorRef.current = clampPullVector(raw, maxPullDistance);
      scheduleFlush();
    },
    [maxPullDistance, scheduleFlush],
  );

  const endPull = useCallback(() => {
    if (phaseRef.current !== 'pulling') return;
    resetPull();
  }, [resetPull]);

  useEffect(() => {
    if (!enabled) return undefined;

    const onPointerMove = (event: PointerEvent) => handlePointerMove(event);
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerId === pointerIdRef.current) endPull();
    };
    const onPointerCancel = (event: PointerEvent) => {
      if (event.pointerId === pointerIdRef.current) endPull();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') endPull();
    };
    const onBlur = () => endPull();

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerCancel);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', onBlur);

    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerCancel);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', onBlur);
    };
  }, [enabled, endPull, handlePointerMove]);

  useLayoutEffect(() => {
    const source = sourceRef.current;
    const connectedElements = getConnectedElements(connectedRef, connectedElementsRef);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      releaseCapture();
      clearPullCssVars(source, connectedElements);
    };
  }, [connectedElementsRef, connectedRef, releaseCapture, sourceRef]);

  useEffect(() => {
    if (!enabled && phaseRef.current !== 'idle') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- disable gate closes active pull
      resetPull();
    }
  }, [enabled, resetPull]);

  useEffect(() => {
    if (phaseRef.current === 'pulling') {
      scheduleFlush();
    }
  }, [prefersReducedMotion, scheduleFlush]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled || event.button !== 0) return;
      // PC custom MVP: touch は Bubble drag / scroll 競合を避けるため無効
      if (event.pointerType === 'touch') return;

      event.preventDefault();

      originRef.current = { x: event.clientX, y: event.clientY };
      pullVectorRef.current = { x: 0, y: 0 };
      pointerIdRef.current = event.pointerId;
      captureTargetRef.current = event.currentTarget;

      event.currentTarget.setPointerCapture(event.pointerId);
      setPhaseIfChanged('pulling');
      scheduleFlush();
    },
    [enabled, scheduleFlush, setPhaseIfChanged],
  );

  return {
    phase,
    isPulling: phase === 'pulling',
    handlers: { onPointerDown },
    starParticleCount,
  };
}
