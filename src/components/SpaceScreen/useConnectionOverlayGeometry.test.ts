// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { computeEndpoints } from './useConnectionOverlayGeometry';

function mockRect(el: HTMLElement, rect: DOMRectInit) {
  el.getBoundingClientRect = () =>
    ({
      x: rect.x ?? rect.left ?? 0,
      y: rect.y ?? rect.top ?? 0,
      left: rect.left ?? 0,
      top: rect.top ?? 0,
      width: rect.width ?? 0,
      height: rect.height ?? 0,
      right: (rect.left ?? 0) + (rect.width ?? 0),
      bottom: (rect.top ?? 0) + (rect.height ?? 0),
      toJSON: () => ({}),
    }) as DOMRect;
}

function createBubbleArea(sourceRect: DOMRectInit, targetRect: DOMRectInit) {
  const bubbleArea = document.createElement('div');
  mockRect(bubbleArea, { left: 50, top: 40, width: 800, height: 600 });

  const source = document.createElement('div');
  source.setAttribute('data-hossii-id', 'h1');
  mockRect(source, sourceRect);

  const target = document.createElement('div');
  target.setAttribute('data-hossii-id', 'h2');
  mockRect(target, targetRect);

  bubbleArea.append(source, target);
  return bubbleArea;
}

describe('computeEndpoints', () => {
  it('updates local coordinates when bubble DOMRects change', () => {
    const firstArea = createBubbleArea(
      { left: 100, top: 100, width: 120, height: 80 },
      { left: 400, top: 200, width: 120, height: 80 },
    );
    const first = computeEndpoints(firstArea, 'h1', 'h2');
    expect(first).not.toBeNull();
    expect(first!.from.x).toBeGreaterThan(0);
    expect(first!.to.x).toBeGreaterThan(first!.from.x);

    const movedArea = createBubbleArea(
      { left: 140, top: 120, width: 120, height: 80 },
      { left: 400, top: 200, width: 120, height: 80 },
    );
    const second = computeEndpoints(movedArea, 'h1', 'h2');
    expect(second!.from.x).toBeGreaterThan(first!.from.x);
  });
});
