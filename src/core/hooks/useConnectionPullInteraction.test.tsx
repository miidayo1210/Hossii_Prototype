// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, fireEvent } from '@testing-library/react';
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

describe('useConnectionPullInteraction', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
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

    act(() => {
      result.current.handlers.onPointerDown({
        button: 0,
        pointerId: 7,
        clientX: 10,
        clientY: 10,
        currentTarget: source,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLElement>);
    });
    expect(result.current.phase).toBe('pulling');

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
    expect(source.style.getPropertyValue('--pull-x')).toBe('0px');

    unmount();
    expect(source.style.getPropertyValue('--pull-progress')).toBe('0');
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
});
