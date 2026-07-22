// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
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

async function flushAnimationFrame() {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

describe('ConnectionPullInteractionDemo', () => {
  beforeEach(() => {
    mockPointerCapture();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('applies transform CSS vars while pulling and resets on pointerup', async () => {
    render(<ConnectionPullInteractionDemo />);
    const source = screen.getByTestId('pull-source');
    const connected = screen.getByTestId('connected-bubble');

    fireEvent.pointerDown(source, { clientX: 100, clientY: 100, pointerId: 1, button: 0 });
    fireEvent.pointerMove(document, { clientX: 160, clientY: 130, pointerId: 1 });
    await flushAnimationFrame();

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
  });

  it('resets on pointercancel', async () => {
    render(<ConnectionPullInteractionDemo />);
    const source = screen.getByTestId('pull-source');

    fireEvent.pointerDown(source, { clientX: 50, clientY: 50, pointerId: 2, button: 0 });
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

    fireEvent.pointerDown(source, { clientX: 80, clientY: 80, pointerId: 3, button: 0 });
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

    fireEvent.pointerDown(source, { clientX: 100, clientY: 100, pointerId: 4, button: 0 });
    fireEvent.pointerMove(document, { clientX: 180, clientY: 140, pointerId: 4 });
    await flushAnimationFrame();

    expect(source.style.left).toBe(sourceLeftBefore);
    expect(connected.style.top).toBe(connectedTopBefore);
    expect(source.style.getPropertyValue('--pull-x')).not.toBe('0px');
  });

  it('shows 1–3 star particles as pull progress increases', async () => {
    render(<ConnectionPullInteractionDemo />);
    const source = screen.getByTestId('pull-source');

    fireEvent.pointerDown(source, { clientX: 0, clientY: 0, pointerId: 5, button: 0 });
    fireEvent.pointerMove(document, { clientX: 100, clientY: 0, pointerId: 5 });
    await flushAnimationFrame();

    const stars = screen.getByTestId('star-particles');
    expect(stars.querySelectorAll('span').length).toBeGreaterThanOrEqual(1);
    expect(stars.querySelectorAll('span').length).toBeLessThanOrEqual(3);
  });
});
