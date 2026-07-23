// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import * as connectionPopoverPosition from '../utils/connectionPopoverPosition';
import { useConnectionPopoverViewport } from './useConnectionPopoverViewport';

describe('useConnectionPopoverViewport', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads initial viewport from window', () => {
    vi.spyOn(connectionPopoverPosition, 'readConnectionPopoverViewport').mockReturnValue({
      height: 500,
      width: 900,
      offsetTop: 0,
      offsetLeft: 0,
    });

    const { result } = renderHook(() => useConnectionPopoverViewport());
    expect(result.current.height).toBe(500);
    expect(result.current.width).toBe(900);
  });

  it('updates on visualViewport resize and cleans up listeners', () => {
    const resizeListeners = new Set<() => void>();
    const scrollListeners = new Set<() => void>();
    const windowResizeListeners = new Set<() => void>();

    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: {
        height: 140,
        width: 844,
        offsetTop: 12,
        offsetLeft: 0,
        addEventListener: vi.fn((_event: string, listener: EventListener) => {
          resizeListeners.add(listener as () => void);
        }),
        removeEventListener: vi.fn((_event: string, listener: EventListener) => {
          resizeListeners.delete(listener as () => void);
        }),
      },
    });

    vi.spyOn(window, 'addEventListener').mockImplementation((event, listener) => {
      if (event === 'resize') windowResizeListeners.add(listener as () => void);
    });
    vi.spyOn(window, 'removeEventListener').mockImplementation((event, listener) => {
      if (event === 'resize') windowResizeListeners.delete(listener as () => void);
    });

    let readCount = 0;
    vi.spyOn(connectionPopoverPosition, 'readConnectionPopoverViewport').mockImplementation(() => {
      readCount += 1;
      if (readCount <= 2) {
        return {
          height: 390,
          width: 844,
          offsetTop: 0,
          offsetLeft: 0,
        };
      }
      return {
        height: 140,
        width: 844,
        offsetTop: 12,
        offsetLeft: 0,
      };
    });

    const { result, unmount } = renderHook(() => useConnectionPopoverViewport());
    expect(result.current.height).toBe(390);

    act(() => {
      for (const listener of resizeListeners) listener();
    });
    expect(result.current.height).toBe(140);
    expect(result.current.offsetTop).toBe(12);

    unmount();
    expect(windowResizeListeners.size).toBe(0);
    expect(resizeListeners.size).toBe(0);
    expect(scrollListeners.size).toBe(0);
  });
});
