// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, fireEvent } from '@testing-library/react';
import { useSpaceConnectionPull } from './useSpaceConnectionPull';
import type { HossiiConnection } from '../../core/types/hossiiConnection';
import {
  DEFAULT_MAX_PULL_DISTANCE_PX,
  MAX_CONNECTED_SHIFT_PX,
} from '../../core/utils/connectionPullMath';

const connectionMeta = {
  createdBy: null,
  createdAt: '2026-07-22T00:00:00Z',
  updatedAt: '2026-07-22T00:00:00Z',
};

const connections: HossiiConnection[] = [
  {
    id: 'c1',
    spaceId: 's1',
    paneId: 'pane-a',
    sourceHossiiId: 'h1',
    targetHossiiId: 'h2',
    strength: 'soft',
    ...connectionMeta,
  },
  {
    id: 'c2',
    spaceId: 's1',
    paneId: 'pane-a',
    sourceHossiiId: 'h2',
    targetHossiiId: 'h3',
    strength: 'medium',
    ...connectionMeta,
  },
];

function setupBubbleArea() {
  const area = document.createElement('div');
  const source = document.createElement('div');
  source.dataset.hossiiId = 'h1';
  const peer = document.createElement('div');
  peer.dataset.hossiiId = 'h2';
  const twoHop = document.createElement('div');
  twoHop.dataset.hossiiId = 'h3';
  area.append(source, peer, twoHop);
  document.body.appendChild(area);

  source.setPointerCapture = vi.fn();
  source.releasePointerCapture = vi.fn();
  source.hasPointerCapture = vi.fn(() => true);

  return { area, source, peer, twoHop };
}

async function flushAnimationFrame() {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

describe('useSpaceConnectionPull', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }));
  });

  it('shows pull handle only with direct connections', () => {
    const { area } = setupBubbleArea();
    const bubbleAreaRef = { current: area };

    const { result: noSelection } = renderHook(() =>
      useSpaceConnectionPull({
        bubbleAreaRef,
        connections,
        selectedBubbleId: null,
        activePaneId: 'pane-a',
        visibleHossiiIds: new Set(['h1', 'h2', 'h3']),
        isConnectionsContextEnabled: true,
        editorPhase: 'idle',
        bubbleInteractionLock: { isDragging: false, isResizing: false },
      }),
    );
    expect(noSelection.current.pullHandleVisible).toBe(false);

    const { result } = renderHook(() =>
      useSpaceConnectionPull({
        bubbleAreaRef,
        connections,
        selectedBubbleId: 'h1',
        activePaneId: 'pane-a',
        visibleHossiiIds: new Set(['h1', 'h2', 'h3']),
        isConnectionsContextEnabled: true,
        editorPhase: 'idle',
        bubbleInteractionLock: { isDragging: false, isResizing: false },
      }),
    );
    expect(result.current.pullHandleVisible).toBe(true);
    expect(result.current.directPeerIds).toEqual(['h2']);
    expect(result.current.twoHopPeerCount).toBe(1);
  });

  it('allows pull for archived/guest contexts when connections enabled', () => {
    const { area } = setupBubbleArea();
    const bubbleAreaRef = { current: area };

    const { result } = renderHook(() =>
      useSpaceConnectionPull({
        bubbleAreaRef,
        connections,
        selectedBubbleId: 'h1',
        activePaneId: 'pane-a',
        visibleHossiiIds: new Set(['h1', 'h2', 'h3']),
        isConnectionsContextEnabled: true,
        editorPhase: 'idle',
        bubbleInteractionLock: { isDragging: false, isResizing: false },
      }),
    );

    expect(result.current.pullEnabled).toBe(true);
  });

  it('disables pull during editor active phases', () => {
    const { area } = setupBubbleArea();
    const bubbleAreaRef = { current: area };

    const { result } = renderHook(() =>
      useSpaceConnectionPull({
        bubbleAreaRef,
        connections,
        selectedBubbleId: 'h1',
        activePaneId: 'pane-a',
        visibleHossiiIds: new Set(['h1', 'h2', 'h3']),
        isConnectionsContextEnabled: true,
        editorPhase: 'pickingTarget',
        bubbleInteractionLock: { isDragging: false, isResizing: false },
      }),
    );

    expect(result.current.pullEnabled).toBe(false);
  });

  it('disables pull during bubble drag or resize', () => {
    const { area } = setupBubbleArea();
    const bubbleAreaRef = { current: area };

    const { result: dragging } = renderHook(() =>
      useSpaceConnectionPull({
        bubbleAreaRef,
        connections,
        selectedBubbleId: 'h1',
        activePaneId: 'pane-a',
        visibleHossiiIds: new Set(['h1', 'h2', 'h3']),
        isConnectionsContextEnabled: true,
        editorPhase: 'idle',
        bubbleInteractionLock: { isDragging: true, isResizing: false },
      }),
    );
    expect(dragging.current.pullEnabled).toBe(false);

    const { result: resizing } = renderHook(() =>
      useSpaceConnectionPull({
        bubbleAreaRef,
        connections,
        selectedBubbleId: 'h1',
        activePaneId: 'pane-a',
        visibleHossiiIds: new Set(['h1', 'h2', 'h3']),
        isConnectionsContextEnabled: true,
        editorPhase: 'idle',
        bubbleInteractionLock: { isDragging: false, isResizing: true },
      }),
    );
    expect(resizing.current.pullEnabled).toBe(false);
  });

  it('clamps pull distance and connected shift during pull', async () => {
    const { area, source, peer } = setupBubbleArea();
    const bubbleAreaRef = { current: area };

    const { result } = renderHook(() =>
      useSpaceConnectionPull({
        bubbleAreaRef,
        connections,
        selectedBubbleId: 'h1',
        activePaneId: 'pane-a',
        visibleHossiiIds: new Set(['h1', 'h2', 'h3']),
        isConnectionsContextEnabled: true,
        editorPhase: 'idle',
        bubbleInteractionLock: { isDragging: false, isResizing: false },
      }),
    );

    act(() => {
      result.current.handlers.onPointerDown({
        button: 0,
        pointerId: 1,
        pointerType: 'mouse',
        clientX: 0,
        clientY: 0,
        currentTarget: source,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLElement>);
    });

    act(() => {
      fireEvent.pointerMove(document, { clientX: 400, clientY: 0, pointerId: 1 });
    });
    await flushAnimationFrame();

    const pullX = Number.parseFloat(source.style.getPropertyValue('--pull-x'));
    expect(Math.hypot(pullX, 0)).toBeCloseTo(DEFAULT_MAX_PULL_DISTANCE_PX, 4);

    const shiftX = Number.parseFloat(peer.style.getPropertyValue('--connected-shift-x'));
    expect(Math.hypot(shiftX, 0)).toBeLessThanOrEqual(MAX_CONNECTED_SHIFT_PX + 0.01);
    expect(result.current.isPulling).toBe(true);
  });

  it('resets on pointerup and when enabled becomes false', async () => {
    const { area, source } = setupBubbleArea();
    const bubbleAreaRef = { current: area };

    const { result, rerender } = renderHook(
      ({ enabledPhase }: { enabledPhase: 'idle' | 'pickingTarget' }) =>
        useSpaceConnectionPull({
          bubbleAreaRef,
          connections,
          selectedBubbleId: 'h1',
          activePaneId: 'pane-a',
          visibleHossiiIds: new Set(['h1', 'h2', 'h3']),
          isConnectionsContextEnabled: true,
          editorPhase: enabledPhase,
          bubbleInteractionLock: { isDragging: false, isResizing: false },
        }),
      { initialProps: { enabledPhase: 'idle' as const } },
    );

    act(() => {
      result.current.handlers.onPointerDown({
        button: 0,
        pointerId: 2,
        pointerType: 'mouse',
        clientX: 0,
        clientY: 0,
        currentTarget: source,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLElement>);
    });
    expect(result.current.isPulling).toBe(true);

    act(() => {
      fireEvent.pointerUp(document, { pointerId: 2 });
    });
    expect(result.current.isPulling).toBe(false);
    expect(source.style.getPropertyValue('--pull-x')).toBe('0px');

    act(() => {
      result.current.handlers.onPointerDown({
        button: 0,
        pointerId: 3,
        pointerType: 'mouse',
        clientX: 0,
        clientY: 0,
        currentTarget: source,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLElement>);
    });

    rerender({ enabledPhase: 'pickingTarget' });
    expect(result.current.isPulling).toBe(false);
  });

  it('ignores touch pointerdown', () => {
    const { area, source } = setupBubbleArea();
    const bubbleAreaRef = { current: area };

    const { result } = renderHook(() =>
      useSpaceConnectionPull({
        bubbleAreaRef,
        connections,
        selectedBubbleId: 'h1',
        activePaneId: 'pane-a',
        visibleHossiiIds: new Set(['h1', 'h2', 'h3']),
        isConnectionsContextEnabled: true,
        editorPhase: 'idle',
        bubbleInteractionLock: { isDragging: false, isResizing: false },
      }),
    );

    act(() => {
      result.current.handlers.onPointerDown({
        button: 0,
        pointerId: 4,
        pointerType: 'touch',
        clientX: 0,
        clientY: 0,
        currentTarget: source,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLElement>);
    });

    expect(result.current.isPulling).toBe(false);
  });
});
