// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHossiiGuideBubble } from './useHossiiGuideBubble';

describe('useHossiiGuideBubble', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows guide message after delay when enabled', async () => {
    const { result, rerender } = renderHook(
      (props) => useHossiiGuideBubble(props),
      {
        initialProps: {
          spaceId: 's1',
          hossiiGuide: { enabled: true, mode: 'package' as const, packageKey: 'reflection' },
          displayReady: true,
          blocked: false,
        },
      },
    );

    expect(result.current.guideMessage).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(result.current.guideMessage).toBeTruthy();

    rerender({
      spaceId: 's1',
      hossiiGuide: { enabled: true, mode: 'package' as const, packageKey: 'reflection' },
      displayReady: true,
      blocked: false,
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(result.current.guideMessage).toBeTruthy();
  });

  it('does not show when disabled', () => {
    const { result } = renderHook(() =>
      useHossiiGuideBubble({
        spaceId: 's1',
        hossiiGuide: { enabled: false, mode: 'package' },
        displayReady: true,
        blocked: false,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.guideMessage).toBeNull();
  });

  it('dismiss prevents re-show in same hook instance', async () => {
    const { result } = renderHook(() =>
      useHossiiGuideBubble({
        spaceId: 's1',
        hossiiGuide: { enabled: true, mode: 'package', packageKey: 'ideas' },
        displayReady: true,
        blocked: false,
      }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(result.current.guideMessage).toBeTruthy();

    act(() => {
      result.current.dismissGuide();
    });
    expect(result.current.guideMessage).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(result.current.guideMessage).toBeNull();
  });

  it('resets when spaceId changes', async () => {
    const { result, rerender } = renderHook(
      (props) => useHossiiGuideBubble(props),
      {
        initialProps: {
          spaceId: 's1',
          hossiiGuide: { enabled: true, mode: 'package' as const, packageKey: 'dialogue' },
          displayReady: true,
          blocked: false,
        },
      },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(result.current.guideMessage).toBeTruthy();

    rerender({
      spaceId: 's2',
      hossiiGuide: { enabled: true, mode: 'package' as const, packageKey: 'dialogue' },
      displayReady: true,
      blocked: false,
    });

    expect(result.current.guideMessage).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(result.current.guideMessage).toBeTruthy();
  });

  it('waits while blocked', async () => {
    const { result, rerender } = renderHook(
      (props) => useHossiiGuideBubble(props),
      {
        initialProps: {
          spaceId: 's1',
          hossiiGuide: { enabled: true, mode: 'package' as const, packageKey: 'gratitude' },
          displayReady: true,
          blocked: true,
        },
      },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(result.current.guideMessage).toBeNull();

    rerender({
      spaceId: 's1',
      hossiiGuide: { enabled: true, mode: 'package' as const, packageKey: 'gratitude' },
      displayReady: true,
      blocked: false,
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(result.current.guideMessage).toBeTruthy();
  });
});
