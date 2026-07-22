// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import {
  DEFAULT_MAX_PULL_DISTANCE_PX,
  MAX_CONNECTED_SHIFT_PX,
} from '../../core/utils/connectionPullMath';
import { ConnectionPullInteractionDemo } from './ConnectionPullInteractionDemo';

function mockPointerCapture() {
  const proto = HTMLElement.prototype as HTMLElement & {
    setPointerCapture?: (id: number) => void;
    releasePointerCapture?: (id: number) => void;
    hasPointerCapture?: (id: number) => boolean;
  };
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
  proto.hasPointerCapture = vi.fn(() => true);
}

function mockReducedMotion(enabled: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)' && enabled,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

async function flushAnimationFrame() {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

describe('ConnectionPullInteractionDemo', () => {
  beforeEach(() => {
    mockPointerCapture();
    mockReducedMotion(false);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('applies transform CSS vars while pulling and resets on pointerup', async () => {
    render(<ConnectionPullInteractionDemo />);
    const source = screen.getByTestId('pull-source');
    const connected = screen.getByTestId('connected-bubble');
    const demo = screen.getByTestId('pull-source').closest('[data-connection-pull-demo]');

    fireEvent.pointerDown(source, {
      clientX: 100,
      clientY: 100,
      pointerId: 1,
      button: 0,
      pointerType: 'mouse',
    });
    fireEvent.pointerMove(document, { clientX: 160, clientY: 130, pointerId: 1 });
    await flushAnimationFrame();

    expect(demo?.getAttribute('data-is-pulling')).toBe('true');
    expect(source.style.getPropertyValue('--pull-x')).not.toBe('0px');
    expect(source.style.getPropertyValue('--pull-y')).not.toBe('0px');
    expect(Number(source.style.getPropertyValue('--pull-progress'))).toBeGreaterThan(0);
    expect(connected.style.getPropertyValue('--connected-shift-x')).not.toBe('0px');

    fireEvent.pointerUp(document, { pointerId: 1 });
    await waitFor(() => {
      expect(source.style.getPropertyValue('--pull-x')).toBe('0px');
      expect(source.style.getPropertyValue('--pull-y')).toBe('0px');
      expect(source.style.getPropertyValue('--pull-progress')).toBe('0');
      expect(connected.style.getPropertyValue('--connected-shift-x')).toBe('0px');
      expect(connected.style.getPropertyValue('--connected-shift-y')).toBe('0px');
    });
    expect(source.getAttribute('data-pull-phase')).toBe('idle');
    expect(demo?.getAttribute('data-is-pulling')).toBe('false');
  });

  it('clamps pull distance to 120px', async () => {
    render(<ConnectionPullInteractionDemo />);
    const source = screen.getByTestId('pull-source');

    fireEvent.pointerDown(source, {
      clientX: 0,
      clientY: 0,
      pointerId: 6,
      button: 0,
      pointerType: 'mouse',
    });
    fireEvent.pointerMove(document, { clientX: 400, clientY: 300, pointerId: 6 });
    await flushAnimationFrame();

    const pullX = Number.parseFloat(source.style.getPropertyValue('--pull-x'));
    const pullY = Number.parseFloat(source.style.getPropertyValue('--pull-y'));
    expect(Math.hypot(pullX, pullY)).toBeCloseTo(DEFAULT_MAX_PULL_DISTANCE_PX, 4);
    expect(Number(source.style.getPropertyValue('--pull-progress'))).toBe(1);
  });

  it('caps connected shift magnitude', async () => {
    render(<ConnectionPullInteractionDemo />);
    const source = screen.getByTestId('pull-source');
    const connected = screen.getByTestId('connected-bubble');

    fireEvent.pointerDown(source, {
      clientX: 0,
      clientY: 0,
      pointerId: 7,
      button: 0,
      pointerType: 'mouse',
    });
    fireEvent.pointerMove(document, {
      clientX: DEFAULT_MAX_PULL_DISTANCE_PX,
      clientY: 0,
      pointerId: 7,
    });
    await flushAnimationFrame();

    const shiftX = Number.parseFloat(connected.style.getPropertyValue('--connected-shift-x'));
    const shiftY = Number.parseFloat(connected.style.getPropertyValue('--connected-shift-y'));
    expect(Math.hypot(shiftX, shiftY)).toBeCloseTo(MAX_CONNECTED_SHIFT_PX, 4);
  });

  it('resets on pointercancel', async () => {
    render(<ConnectionPullInteractionDemo />);
    const source = screen.getByTestId('pull-source');

    fireEvent.pointerDown(source, {
      clientX: 50,
      clientY: 50,
      pointerId: 2,
      button: 0,
      pointerType: 'mouse',
    });
    fireEvent.pointerMove(document, { clientX: 120, clientY: 50, pointerId: 2 });
    await flushAnimationFrame();
    expect(source.style.getPropertyValue('--pull-x')).not.toBe('0px');

    fireEvent.pointerCancel(document, { pointerId: 2 });
    await waitFor(() => {
      expect(source.style.getPropertyValue('--pull-x')).toBe('0px');
    });
  });

  it('resets on Escape', async () => {
    render(<ConnectionPullInteractionDemo />);
    const source = screen.getByTestId('pull-source');

    fireEvent.pointerDown(source, {
      clientX: 80,
      clientY: 80,
      pointerId: 3,
      button: 0,
      pointerType: 'mouse',
    });
    fireEvent.pointerMove(document, { clientX: 140, clientY: 80, pointerId: 3 });
    await flushAnimationFrame();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(source.style.getPropertyValue('--pull-x')).toBe('0px');
    });
  });

  it('does not mutate left/top style during pull', async () => {
    render(<ConnectionPullInteractionDemo />);
    const source = screen.getByTestId('pull-source');
    const connected = screen.getByTestId('connected-bubble');
    const sourceLeftBefore = source.style.left;
    const connectedTopBefore = connected.style.top;

    fireEvent.pointerDown(source, {
      clientX: 100,
      clientY: 100,
      pointerId: 4,
      button: 0,
      pointerType: 'mouse',
    });
    fireEvent.pointerMove(document, { clientX: 180, clientY: 140, pointerId: 4 });
    await flushAnimationFrame();

    expect(source.style.left).toBe(sourceLeftBefore);
    expect(connected.style.top).toBe(connectedTopBefore);
    expect(source.style.getPropertyValue('--pull-x')).not.toBe('0px');
  });

  it('shows 1–3 star particles as pull progress increases', async () => {
    render(<ConnectionPullInteractionDemo />);
    const source = screen.getByTestId('pull-source');

    fireEvent.pointerDown(source, {
      clientX: 0,
      clientY: 0,
      pointerId: 5,
      button: 0,
      pointerType: 'mouse',
    });
    fireEvent.pointerMove(document, { clientX: 100, clientY: 0, pointerId: 5 });
    await flushAnimationFrame();

    const stars = screen.getByTestId('star-particles');
    expect(stars.querySelectorAll('span').length).toBeGreaterThanOrEqual(1);
    expect(stars.querySelectorAll('span').length).toBeLessThanOrEqual(3);
  });

  it('ignores touch pointerdown', () => {
    render(<ConnectionPullInteractionDemo />);
    const source = screen.getByTestId('pull-source');
    const demo = source.closest('[data-connection-pull-demo]');

    fireEvent.pointerDown(source, {
      clientX: 0,
      clientY: 0,
      pointerId: 8,
      button: 0,
      pointerType: 'touch',
    });

    expect(demo?.getAttribute('data-is-pulling')).toBe('false');
    expect(source.getAttribute('data-pull-phase')).toBe('idle');
  });

  it('suppresses connected shift and glow under reduced motion', async () => {
    mockReducedMotion(true);
    render(<ConnectionPullInteractionDemo />);
    const source = screen.getByTestId('pull-source');
    const connected = screen.getByTestId('connected-bubble');

    fireEvent.pointerDown(source, {
      clientX: 0,
      clientY: 0,
      pointerId: 9,
      button: 0,
      pointerType: 'mouse',
    });
    fireEvent.pointerMove(document, {
      clientX: DEFAULT_MAX_PULL_DISTANCE_PX,
      clientY: 0,
      pointerId: 9,
    });
    await flushAnimationFrame();

    expect(source.style.getPropertyValue('--pull-x')).not.toBe('0px');
    expect(connected.style.getPropertyValue('--connected-shift-x')).toBe('0px');
    expect(connected.style.getPropertyValue('--connected-shift-y')).toBe('0px');
    expect(Number(source.style.getPropertyValue('--glow-progress'))).toBeLessThanOrEqual(0.25);
    expect(screen.getByTestId('star-particles').querySelectorAll('span').length).toBe(1);
  });
});
