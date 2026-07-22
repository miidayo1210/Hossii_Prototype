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

export type ConnectionPullPhase = 'idle' | 'pulling';

export type UseConnectionPullInteractionOptions = {
  sourceRef: RefObject<HTMLElement | null>;
  connectedRef?: RefObject<HTMLElement | null>;
  enabled?: boolean;
  maxPullDistance?: number;
};

export type ConnectionPullInteractionHandlers = {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
};

export type UseConnectionPullInteractionResult = {
  phase: ConnectionPullPhase;
  handlers: ConnectionPullInteractionHandlers;
  starParticleCount: 1 | 2 | 3;
};

function applyPullCssVars(
  source: HTMLElement,
  connected: HTMLElement | null | undefined,
  pullVector: Point2D,
  progress: number,
): 1 | 2 | 3 {
  const glow = computePullGlowProgress(progress);
  const shift = computeConnectedBubbleShift(pullVector, progress);
  const starCount = computeTwoHopStarParticleCount(progress);

  source.style.setProperty(CSS.pullX, `${pullVector.x}px`);
  source.style.setProperty(CSS.pullY, `${pullVector.y}px`);
  source.style.setProperty(CSS.pullProgress, String(progress));
  source.style.setProperty(CSS.glowProgress, String(glow));

  if (connected) {
    connected.style.setProperty(CSS.connectedShiftX, `${shift.x}px`);
    connected.style.setProperty(CSS.connectedShiftY, `${shift.y}px`);
  }

  return starCount;
}

function clearPullCssVars(source: HTMLElement | null, connected: HTMLElement | null | undefined): void {
  if (source) {
    source.style.setProperty(CSS.pullX, '0px');
    source.style.setProperty(CSS.pullY, '0px');
    source.style.setProperty(CSS.pullProgress, '0');
    source.style.setProperty(CSS.glowProgress, '0');
  }
  if (connected) {
    connected.style.setProperty(CSS.connectedShiftX, '0px');
    connected.style.setProperty(CSS.connectedShiftY, '0px');
  }
}

export function useConnectionPullInteraction({
  sourceRef,
  connectedRef,
  enabled = true,
  maxPullDistance = DEFAULT_MAX_PULL_DISTANCE_PX,
}: UseConnectionPullInteractionOptions): UseConnectionPullInteractionResult {
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
      connectedRef?.current,
      pullVectorRef.current,
      progress,
    );
    syncStarCountIfChanged(nextStars);
  }, [connectedRef, maxPullDistance, sourceRef, syncStarCountIfChanged]);

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
    clearPullCssVars(sourceRef.current, connectedRef?.current);
    syncStarCountIfChanged(1);
    setPhaseIfChanged('idle');
    releaseCapture();
  }, [connectedRef, releaseCapture, setPhaseIfChanged, sourceRef, syncStarCountIfChanged]);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (phaseRef.current !== 'pulling' || event.pointerId !== pointerIdRef.current) return;
      pullVectorRef.current = computeDragVector(originRef.current, {
        x: event.clientX,
        y: event.clientY,
      });
      scheduleFlush();
    },
    [scheduleFlush],
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
    const connected = connectedRef?.current;
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      releaseCapture();
      clearPullCssVars(source, connected);
    };
  }, [connectedRef, releaseCapture, sourceRef]);

  useEffect(() => {
    if (!enabled && phaseRef.current !== 'idle') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- disable gate closes active pull
      resetPull();
    }
  }, [enabled, resetPull]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled || event.button !== 0) return;
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
    handlers: { onPointerDown },
    starParticleCount,
  };
}
