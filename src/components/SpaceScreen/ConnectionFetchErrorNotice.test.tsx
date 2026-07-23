// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ConnectionFetchErrorNotice } from './ConnectionFetchErrorNotice';

afterEach(cleanup);

describe('ConnectionFetchErrorNotice', () => {
  it('shows message and retry button', () => {
    render(<ConnectionFetchErrorNotice onRetry={vi.fn()} />);

    expect(screen.getByRole('status').textContent).toContain('つながりを読み込めませんでした');
    expect(screen.getByRole('button', { name: '再試行' })).toBeTruthy();
  });

  it('calls onRetry when retry is clicked', () => {
    const onRetry = vi.fn();
    render(<ConnectionFetchErrorNotice onRetry={onRetry} />);

    fireEvent.click(screen.getByRole('button', { name: '再試行' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
