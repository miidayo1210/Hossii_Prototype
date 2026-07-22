// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { BubbleActionMenu } from './BubbleActionMenu';

afterEach(cleanup);

const anchorRect = {
  left: 100,
  top: 200,
  right: 260,
  bottom: 320,
  width: 160,
  height: 120,
  x: 100,
  y: 200,
  toJSON: () => ({}),
} as DOMRect;

describe('BubbleActionMenu', () => {
  it('renders only provided actions', () => {
    render(
      <BubbleActionMenu
        anchorRect={anchorRect}
        onViewDetail={() => {}}
        onConnect={() => {}}
        connectionCount={2}
        onConnectionsClick={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'くわしく見る' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'つないでみる' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'つながり 2' })).toBeTruthy();
  });

  it('hides connect actions when callbacks are omitted', () => {
    render(<BubbleActionMenu anchorRect={anchorRect} onViewDetail={() => {}} />);

    expect(screen.getByRole('button', { name: 'くわしく見る' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'つないでみる' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^つながり / })).toBeNull();
  });

  it('invokes callbacks on click', () => {
    const onViewDetail = vi.fn();
    const onConnect = vi.fn();

    render(
      <BubbleActionMenu
        anchorRect={anchorRect}
        onViewDetail={onViewDetail}
        onConnect={onConnect}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'くわしく見る' }));
    fireEvent.click(screen.getByRole('button', { name: 'つないでみる' }));

    expect(onViewDetail).toHaveBeenCalledTimes(1);
    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it('portals to document.body', () => {
    render(<BubbleActionMenu anchorRect={anchorRect} onViewDetail={() => {}} />);
    const menu = screen.getByRole('button', { name: 'くわしく見る' }).closest('[data-bubble-action-menu]');
    expect(menu?.parentElement).toBe(document.body);
  });

  it('renders pull handle when direct connections exist', () => {
    const onPullHandlePointerDown = vi.fn();
    render(
      <BubbleActionMenu
        anchorRect={anchorRect}
        onViewDetail={() => {}}
        showPullHandle
        onPullHandlePointerDown={onPullHandlePointerDown}
      />,
    );

    const handle = screen.getByRole('button', { name: 'つながりを引っ張る' });
    expect(handle).toBeTruthy();
    fireEvent.pointerDown(handle, { pointerType: 'mouse', button: 0, pointerId: 1 });
    expect(onPullHandlePointerDown).toHaveBeenCalledTimes(1);
  });

  it('hides pull handle when showPullHandle is false', () => {
    render(
      <BubbleActionMenu
        anchorRect={anchorRect}
        onViewDetail={() => {}}
        showPullHandle={false}
        onPullHandlePointerDown={() => {}}
      />,
    );
    expect(screen.queryByRole('button', { name: 'つながりを引っ張る' })).toBeNull();
  });
});
