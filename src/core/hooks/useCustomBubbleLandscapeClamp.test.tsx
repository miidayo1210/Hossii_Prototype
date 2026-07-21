// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup, waitFor } from '@testing-library/react';
import { useLayoutEffect, useRef, useState } from 'react';
import {
  MOBILE_LANDSCAPE_BUBBLE_MQ,
  type AxisRect,
  isRectInsideArea,
  bubbleRectAfterClamp,
} from '../utils/customBubbleLandscapePlacement';
import { useCustomBubbleLandscapeClamp } from './useCustomBubbleLandscapeClamp';

afterEach(cleanup);

type RectInput = AxisRect;

function toDOMRect(r: RectInput): DOMRect {
  const width = r.right - r.left;
  const height = r.bottom - r.top;
  return {
    x: r.left,
    y: r.top,
    width,
    height,
    top: r.top,
    left: r.left,
    right: r.right,
    bottom: r.bottom,
    toJSON: () => ({}),
  } as DOMRect;
}

function rectWithHeight(base: RectInput, height: number): RectInput {
  return {
    left: base.left,
    top: base.top,
    right: base.right,
    bottom: base.top + height,
  };
}

const resizeObserverCallbacks = new Map<Element, ResizeObserverCallback>();

class MockResizeObserver implements ResizeObserver {
  private readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element): void {
    resizeObserverCallbacks.set(target, this.callback);
  }

  unobserve(target: Element): void {
    resizeObserverCallbacks.delete(target);
  }

  disconnect(): void {
    for (const key of resizeObserverCallbacks.keys()) {
      if (resizeObserverCallbacks.get(key) === this.callback) {
        resizeObserverCallbacks.delete(key);
      }
    }
  }
}

function triggerResizeObserver(target: Element): void {
  const cb = resizeObserverCallbacks.get(target);
  if (cb) {
    cb([], {} as ResizeObserver);
  }
}

function mockMatchMedia(landscape: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === MOBILE_LANDSCAPE_BUBBLE_MQ ? landscape : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

type ProbeProps = {
  naturalRect: RectInput;
  areaRect: RectInput;
  remeasureKeys?: readonly unknown[];
};

function LandscapeClampProbe({
  naturalRect,
  areaRect,
  remeasureKeys = [],
}: ProbeProps) {
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const naturalRef = useRef(naturalRect);

  useLayoutEffect(() => {
    naturalRef.current = naturalRect;
  }, [naturalRect]);

  const bindBubbleRef = (node: HTMLDivElement | null) => {
    bubbleRef.current = node;
    if (!node) return;
    const area = node.closest('[data-bubble-area]') as HTMLElement | null;
    if (area) {
      area.getBoundingClientRect = () => toDOMRect(areaRect);
    }
    node.getBoundingClientRect = () => toDOMRect(naturalRef.current);
    node.style.transform = 'none';
  };

  const { offset } = useCustomBubbleLandscapeClamp(bubbleRef, remeasureKeys);

  useLayoutEffect(() => {
    const node = bubbleRef.current;
    if (!node) return;
    const natural = naturalRef.current;
    node.style.transform = `translate(${offset.x}px, ${offset.y}px)`;
    node.getBoundingClientRect = () =>
      toDOMRect({
        left: natural.left + offset.x,
        top: natural.top + offset.y,
        right: natural.right + offset.x,
        bottom: natural.bottom + offset.y,
      });
  }, [offset, naturalRect]);

  return (
    <div data-bubble-area>
      <div ref={bindBubbleRef} data-testid="bubble" />
      <output data-testid="offset-x">{offset.x}</output>
      <output data-testid="offset-y">{offset.y}</output>
    </div>
  );
}

function HeightChangeProbe({
  naturalBase,
  areaRect,
}: {
  naturalBase: RectInput;
  areaRect: RectInput;
}) {
  const [height, setHeight] = useState(naturalBase.bottom - naturalBase.top);
  const naturalRect = rectWithHeight(naturalBase, height);

  return (
    <>
      <LandscapeClampProbe
        naturalRect={naturalRect}
        areaRect={areaRect}
        remeasureKeys={[height]}
      />
      <button type="button" data-testid="grow" onClick={() => setHeight(121.296875)}>
        grow
      </button>
    </>
  );
}

describe('useCustomBubbleLandscapeClamp', () => {
  const areaRect: RectInput = {
    left: 0,
    top: 112.5,
    right: 843.6875,
    bottom: 501.984375,
  };

  beforeEach(() => {
    resizeObserverCallbacks.clear();
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    mockMatchMedia(true);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns zero offset when not in landscape MQ', () => {
    mockMatchMedia(false);
    render(
      <LandscapeClampProbe
        naturalRect={{ left: 798, top: 329, right: 869, bottom: 450 }}
        areaRect={areaRect}
      />,
    );
    expect(screen.getByTestId('offset-x').textContent).toBe('0');
    expect(screen.getByTestId('offset-y').textContent).toBe('0');
  });

  it('clamps right-edge bubble with fractional DPR-like rects', async () => {
    const natural = {
      left: 798.7581481933594,
      top: 329.605224609375,
      right: 869.7268981933594,
      bottom: 450.902099609375,
    };
    render(<LandscapeClampProbe naturalRect={natural} areaRect={areaRect} />);
    await act(async () => {
      await Promise.resolve();
    });
    const x = Number(screen.getByTestId('offset-x').textContent);
    expect(x).toBeLessThan(0);
    expect(isRectInsideArea(bubbleRectAfterClamp(natural, { x, y: 0 }), areaRect, 8)).toBe(
      true,
    );
  });

  it('clamps right and bottom simultaneously', async () => {
    const natural = {
      left: 720.156,
      top: 380.492,
      right: 920.156,
      bottom: 530.902,
    };
    render(<LandscapeClampProbe naturalRect={natural} areaRect={areaRect} />);
    await act(async () => {
      await Promise.resolve();
    });
    const x = Number(screen.getByTestId('offset-x').textContent);
    const y = Number(screen.getByTestId('offset-y').textContent);
    expect(x).toBeLessThan(0);
    expect(y).toBeLessThan(0);
    expect(isRectInsideArea(bubbleRectAfterClamp(natural, { x, y }), areaRect, 8)).toBe(true);
  });

  it('re-measures when content height grows via ResizeObserver (image/font load)', async () => {
    const naturalBase = {
      left: 531.109375,
      top: 387.404846,
      right: 731.109375,
      bottom: 468.701721,
    };
    render(<HeightChangeProbe naturalBase={naturalBase} areaRect={areaRect} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(Number(screen.getByTestId('offset-y').textContent)).toBe(0);

    await act(async () => {
      screen.getByTestId('grow').click();
      await Promise.resolve();
    });

    const bubble = screen.getByTestId('bubble');
    const tall = rectWithHeight(naturalBase, 121.296875);
    bubble.getBoundingClientRect = () => toDOMRect(tall);
    triggerResizeObserver(bubble);

    await waitFor(() => {
      expect(Number(screen.getByTestId('offset-y').textContent)).toBeLessThan(0);
    });

    const y = Number(screen.getByTestId('offset-y').textContent);
    const x = Number(screen.getByTestId('offset-x').textContent);
    expect(isRectInsideArea(bubbleRectAfterClamp(tall, { x, y }), areaRect, 8)).toBe(true);
  });

  it('recomputes when remeasureKeys change (操作メニュー展開相当)', async () => {
    const collapsed = {
      left: 531,
      top: 400,
      right: 731,
      bottom: 505,
    };
    const expanded = { ...collapsed, bottom: 545 };
    const { rerender } = render(
      <LandscapeClampProbe
        naturalRect={collapsed}
        areaRect={areaRect}
        remeasureKeys={['collapsed']}
      />,
    );
    await waitFor(() => {
      expect(Number(screen.getByTestId('offset-y').textContent)).toBeLessThanOrEqual(0);
    });
    const yBefore = Number(screen.getByTestId('offset-y').textContent);

    rerender(
      <LandscapeClampProbe
        naturalRect={expanded}
        areaRect={areaRect}
        remeasureKeys={['expanded']}
      />,
    );
    await waitFor(() => {
      expect(Number(screen.getByTestId('offset-y').textContent)).toBeLessThan(yBefore);
    });
  });
});
