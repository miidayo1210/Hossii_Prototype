// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AccountSectionNav } from './AccountSectionNav';

describe('AccountSectionNav', () => {
  afterEach(cleanup);

  it('renders all four section tabs', () => {
    render(<AccountSectionNav activeSection="home" onNavigate={vi.fn()} />);

    expect(screen.getByRole('tab', { name: 'ホーム' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'プロフィール' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: '参加先' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'マイHossii' })).toBeTruthy();
  });

  it('marks active section with aria-selected', () => {
    render(<AccountSectionNav activeSection="profile" onNavigate={vi.fn()} />);

    expect(screen.getByRole('tab', { name: 'プロフィール' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'ホーム' }).getAttribute('aria-selected')).toBe('false');
  });

  it('calls onNavigate with account and param when tab clicked', () => {
    const onNavigate = vi.fn();
    render(<AccountSectionNav activeSection="home" onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole('tab', { name: '参加先' }));
    expect(onNavigate).toHaveBeenCalledWith('account', 'spaces');

    fireEvent.click(screen.getByRole('tab', { name: 'ホーム' }));
    expect(onNavigate).toHaveBeenCalledWith('account', undefined);
  });
});
