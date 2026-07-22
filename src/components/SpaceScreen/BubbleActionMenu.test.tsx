// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { BubbleActionMenu } from './BubbleActionMenu';

afterEach(cleanup);

describe('BubbleActionMenu', () => {
  it('renders only provided actions', () => {
    render(
      <BubbleActionMenu
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
    render(<BubbleActionMenu onViewDetail={() => {}} />);

    expect(screen.getByRole('button', { name: 'くわしく見る' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'つないでみる' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^つながり / })).toBeNull();
  });

  it('invokes callbacks on click', () => {
    const onViewDetail = vi.fn();
    const onConnect = vi.fn();

    render(
      <BubbleActionMenu onViewDetail={onViewDetail} onConnect={onConnect} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'くわしく見る' }));
    fireEvent.click(screen.getByRole('button', { name: 'つないでみる' }));

    expect(onViewDetail).toHaveBeenCalledTimes(1);
    expect(onConnect).toHaveBeenCalledTimes(1);
  });
});
