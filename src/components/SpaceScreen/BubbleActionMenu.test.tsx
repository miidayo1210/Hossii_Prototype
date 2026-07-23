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



  it('renders create connected hossii action when callback is provided', () => {
    const onCreateConnectedHossii = vi.fn();
    render(
      <BubbleActionMenu
        anchorRect={anchorRect}
        onViewDetail={() => {}}
        onCreateConnectedHossii={onCreateConnectedHossii}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'つなげて作る' }));
    expect(onCreateConnectedHossii).toHaveBeenCalledTimes(1);
  });

  it('hides create connected hossii action when callback is omitted', () => {
    render(<BubbleActionMenu anchorRect={anchorRect} onViewDetail={() => {}} />);
    expect(screen.queryByRole('button', { name: 'つなげて作る' })).toBeNull();
  });

  it('shows both Type A connect and Type B create actions', () => {
    render(
      <BubbleActionMenu
        anchorRect={anchorRect}
        onViewDetail={() => {}}
        onConnect={() => {}}
        onCreateConnectedHossii={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'つないでみる' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'つなげて作る' })).toBeTruthy();
  });

  it('shows create blocked reason when connect is unavailable', () => {
    render(
      <BubbleActionMenu
        anchorRect={anchorRect}
        onViewDetail={() => {}}
        connectionCreateBlockedReason="参加すると、つながりを作れます"
      />,
    );

    expect(screen.getByText('参加すると、つながりを作れます')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'つないでみる' })).toBeNull();
  });

  it('does not show create blocked reason when connect is available', () => {
    render(
      <BubbleActionMenu
        anchorRect={anchorRect}
        onViewDetail={() => {}}
        onConnect={() => {}}
        connectionCreateBlockedReason="参加すると、つながりを作れます"
      />,
    );

    expect(screen.getByRole('button', { name: 'つないでみる' })).toBeTruthy();
    expect(screen.queryByText('参加すると、つながりを作れます')).toBeNull();
  });

  it('shows joining status without connect action', () => {
    render(
      <BubbleActionMenu
        anchorRect={anchorRect}
        onViewDetail={() => {}}
        membershipJoinStatus="joining"
      />,
    );

    expect(screen.getByText('参加確認中…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'つないでみる' })).toBeNull();
  });

  it('shows retry action on membership error', () => {
    const onMembershipRetry = vi.fn();
    render(
      <BubbleActionMenu
        anchorRect={anchorRect}
        onViewDetail={() => {}}
        membershipJoinStatus="error"
        onMembershipRetry={onMembershipRetry}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'もう一度試す' }));
    expect(onMembershipRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'つないでみる' })).toBeNull();
  });

  it('shows connect action when membership is active', () => {
    render(
      <BubbleActionMenu
        anchorRect={anchorRect}
        onViewDetail={() => {}}
        onConnect={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'つないでみる' })).toBeTruthy();
    expect(screen.queryByText('参加確認中…')).toBeNull();
    expect(screen.queryByRole('button', { name: 'もう一度試す' })).toBeNull();
  });
});
