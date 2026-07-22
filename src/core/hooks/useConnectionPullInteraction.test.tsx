// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, fireEvent } from '@testing-library/react';
import {
  DEFAULT_MAX_PULL_DISTANCE_PX,
  MAX_CONNECTED_SHIFT_PX,
  REDUCED_MOTION_GLOW_CAP,
} from '../utils/connectionPullMath';
import { useConnectionPullInteraction } from './useConnectionPullInteraction';

function attachElement(): HTMLDivElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  el.setPointerCapture = vi.fn();
  el.releasePointerCapture = vi.fn();
  el.hasPointerCapture = vi.fn(() => true);
  return el;
}

async function flushAnimationFrame() {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function mockReducedMotion(enabled: boolean) {
  const listeners = new Set<() => void>();
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)' && enabled,
    media: query,
    onchange: null,
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

describe('useConnectionPullInteraction', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    mockReducedMotion(false);
  });

  it('transitions idle → pulling → idle', async () => {
    const source = attachElement();
    const connected = attachElement();
    const sourceRef = { current: source };
    const connectedRef = { current: connected };

    const { result, unmount } = renderHook(() =>
      useConnectionPullInteraction({ sourceRef, connectedRef }),
    );

    expect(result.current.phase).toBe('idle');
    expect(result.current.isPulling).toBe(false);

    act(() => {
      result.current.handlers.onPointerDown({
        button: 0,
        pointerId: 7,
        pointerType: 'mouse',
        clientX: 10,
        clientY: 10,
        currentTarget: source,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLElement>);
    });
    expect(result.current.phase).toBe('pulling');
    expect(result.current.isPulling).toBe(true);

    act(() => {
      fireEvent.pointerMove(document, { clientX: 80, clientY: 10, pointerId: 7 });
    });
    await flushAnimationFrame();
    expect(source.style.getPropertyValue('--pull-x')).not.toBe('0px');
    expect(source.style.getPropertyValue('--pull-x')).not.toBe('');
    expect(connected.style.getPropertyValue('--connected-shift-x')).not.toBe('0px');

    act(() => {
      fireEvent.pointerUp(document, { pointerId: 7 });
    });
    expect(result.current.phase).toBe('idle');
    expect(result.current.isPulling).toBe(false);
    expect(source.style.getPropertyValue('--pull-x')).toBe('0px');

    unmount();
    expect(source.style.getPropertyValue('--pull-progress')).toBe('0');
  });

  it('clamps pull CSS vars to max distance while preserving direction', async () => {
    const source = attachElement();
    const sourceRef = { current: source };

    const { result } = renderHook(() => useConnectionPullInteraction({ sourceRef }));

    act(() => {
      result.current.handlers.onPointerDown({
        button: 0,
        pointerId: 11,
        pointerType: 'mouse',
        clientX: 0,
        clientY: 0,
        currentTarget: source,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLElement>);
    });

    act(() => {
      fireEvent.pointerMove(document, { clientX: 300, clientY: 200, pointerId: 11 });
    });
    await flushAnimationFrame();

    const pullX = Number.parseFloat(source.style.getPropertyValue('--pull-x'));
    const pullY = Number.parseFloat(source.style.getPropertyValue('--pull-y'));
    expect(Math.hypot(pullX, pullY)).toBeCloseTo(DEFAULT_MAX_PULL_DISTANCE_PX, 4);
    expect(pullX / pullY).toBeCloseTo(300 / 200, 4);
    expect(Number(source.style.getPropertyValue('--pull-progress'))).toBeCloseTo(1, 5);
  });

  it('caps connected shift magnitude', async () => {
    const source = attachElement();
    const connected = attachElement();
    const sourceRef = { current: source };
    const connectedRef = { current: connected };

    const { result } = renderHook(() =>
      useConnectionPullInteraction({ sourceRef, connectedRef }),
    );

    act(() => {
      result.current.handlers.onPointerDown({
        button: 0,
        pointerId: 12,
        pointerType: 'mouse',
        clientX: 0,
        clientY: 0,
        currentTarget: source,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLElement>);
    });

    act(() => {
      fireEvent.pointerMove(document, { clientX: DEFAULT_MAX_PULL_DISTANCE_PX, clientY: 0, pointerId: 12 });
    });
    await flushAnimationFrame();

    const shiftX = Number.parseFloat(connected.style.getPropertyValue('--connected-shift-x'));
    const shiftY = Number.parseFloat(connected.style.getPropertyValue('--connected-shift-y'));
    expect(Math.hypot(shiftX, shiftY)).toBeCloseTo(MAX_CONNECTED_SHIFT_PX, 4);
  });

  it('resets immediately when enabled becomes false during pull', async () => {
    const source = attachElement();
    const sourceRef = { current: source };

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useConnectionPullInteraction({ sourceRef, enabled }),
      { initialProps: { enabled: true } },
    );

    act(() => {
      result.current.handlers.onPointerDown({
        button: 0,
        pointerId: 13,
        pointerType: 'mouse',
        clientX: 0,
        clientY: 0,
        currentTarget: source,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLElement>);
    });
    expect(result.current.isPulling).toBe(true);

    rerender({ enabled: false });

    expect(result.current.phase).toBe('idle');
    expect(result.current.isPulling).toBe(false);
    expect(source.style.getPropertyValue('--pull-x')).toBe('0px');
  });

  it('does not start pull when enabled is false', () => {
    const source = attachElement();
    const sourceRef = { current: source };

    const { result } = renderHook(() =>
      useConnectionPullInteraction({ sourceRef, enabled: false }),
    );

    act(() => {
      result.current.handlers.onPointerDown({
        button: 0,
        pointerId: 14,
        pointerType: 'mouse',
        clientX: 0,
        clientY: 0,
        currentTarget: source,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLElement>);
    });

    expect(result.current.isPulling).toBe(false);
    expect(source.style.getPropertyValue('--pull-progress')).toBe('');
  });

  it('ignores touch pointerdown (PC custom MVP)', () => {
    const source = attachElement();
    const sourceRef = { current: source };

    const { result } = renderHook(() => useConnectionPullInteraction({ sourceRef }));

    act(() => {
      result.current.handlers.onPointerDown({
        button: 0,
        pointerId: 15,
        pointerType: 'touch',
        clientX: 0,
        clientY: 0,
        currentTarget: source,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLElement>);
    });

    expect(result.current.isPulling).toBe(false);
  });

  it('limits re-renders during pointermove (CSS vars only)', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    const source = attachElement();
    const sourceRef = { current: source };
    let renderCount = 0;

    const { result } = renderHook(() => {
      renderCount += 1;
      return useConnectionPullInteraction({ sourceRef });
    });

    act(() => {
      result.current.handlers.onPointerDown({
        button: 0,
        pointerId: 9,
        pointerType: 'mouse',
        clientX: 0,
        clientY: 0,
        currentTarget: source,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLElement>);
    });
    const afterDown = renderCount;

    act(() => {
      for (let x = 10; x <= 100; x += 10) {
        fireEvent.pointerMove(document, { clientX: x, clientY: 0, pointerId: 9 });
      }
    });

    expect(renderCount - afterDown).toBeLessThanOrEqual(2);
    expect(result.current.phase).toBe('pulling');
  });

  it('cleans up on window blur', () => {
    const source = attachElement();
    const sourceRef = { current: source };

    const { result } = renderHook(() => useConnectionPullInteraction({ sourceRef }));

    act(() => {
      result.current.handlers.onPointerDown({
        button: 0,
        pointerId: 8,
        pointerType: 'mouse',
        clientX: 0,
        clientY: 0,
        currentTarget: source,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLElement>);
    });

    act(() => {
      window.dispatchEvent(new Event('blur'));
    });

    expect(result.current.phase).toBe('idle');
    expect(source.style.getPropertyValue('--pull-progress')).toBe('0');
  });

  it('resets on pointercancel and Escape', async () => {
    const source = attachElement();
    const sourceRef = { current: source };

    const { result } = renderHook(() => useConnectionPullInteraction({ sourceRef }));

    act(() => {
      result.current.handlers.onPointerDown({
        button: 0,
        pointerId: 16,
        pointerType: 'mouse',
        clientX: 0,
        clientY: 0,
        currentTarget: source,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLElement>);
    });

    act(() => {
      fireEvent.pointerMove(document, { clientX: 80, clientY: 0, pointerId: 16 });
    });
    await flushAnimationFrame();

    act(() => {
      fireEvent.pointerCancel(document, { pointerId: 16 });
    });
    expect(result.current.isPulling).toBe(false);

    act(() => {
      result.current.handlers.onPointerDown({
        button: 0,
        pointerId: 17,
        pointerType: 'mouse',
        clientX: 0,
        clientY: 0,
        currentTarget: source,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLElement>);
    });

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    expect(result.current.isPulling).toBe(false);
  });

  it('applies reduced-motion output while keeping pull operable', async () => {
    mockReducedMotion(true);
    const source = attachElement();
    const connected = attachElement();
    const sourceRef = { current: source };
    const connectedRef = { current: connected };

    const { result } = renderHook(() =>
      useConnectionPullInteraction({ sourceRef, connectedRef }),
    );

    act(() => {
      result.current.handlers.onPointerDown({
        button: 0,
        pointerId: 18,
        pointerType: 'mouse',
        clientX: 0,
        clientY: 0,
        currentTarget: source,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLElement>);
    });

    act(() => {
      fireEvent.pointerMove(document, { clientX: DEFAULT_MAX_PULL_DISTANCE_PX, clientY: 0, pointerId: 18 });
    });
    await flushAnimationFrame();

    expect(result.current.isPulling).toBe(true);
    expect(source.dataset.reducedMotion).toBe('true');
    expect(Number(source.style.getPropertyValue('--glow-progress'))).toBeLessThanOrEqual(
      REDUCED_MOTION_GLOW_CAP,
    );
    expect(connected.style.getPropertyValue('--connected-shift-x')).toBe('0px');
    expect(connected.style.getPropertyValue('--connected-shift-y')).toBe('0px');
    expect(result.current.starParticleCount).toBe(1);
  });
});
