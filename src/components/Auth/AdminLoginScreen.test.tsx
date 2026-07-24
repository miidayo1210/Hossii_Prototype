// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { AdminAccessDeniedError } from '../../core/auth/adminAccessDeniedError';
import { ADMIN_LOGIN_ERROR_MESSAGES } from './adminLoginErrorMessage';
import { AdminLoginScreen } from './AdminLoginScreen';

const h = vi.hoisted(() => ({
  adminLogin: vi.fn(),
  adminSignUp: vi.fn(),
  logout: vi.fn(),
  onLoginSuccess: vi.fn(),
}));

vi.mock('../../core/contexts/useAuth', () => ({
  useAuth: () => ({
    adminLogin: h.adminLogin,
    adminSignUp: h.adminSignUp,
    logout: h.logout,
  }),
}));

vi.mock('./AuthEntryShell', () => ({
  AuthEntryShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe('AdminLoginScreen', () => {
  afterEach(cleanup);

  beforeEach(() => {
    h.adminLogin.mockReset();
    h.adminSignUp.mockReset();
    h.logout.mockReset();
    h.onLoginSuccess.mockReset();
  });

  async function submitLogin(email: string, password: string) {
    fireEvent.change(screen.getByPlaceholderText('メールアドレス'), { target: { value: email } });
    fireEvent.change(screen.getByPlaceholderText('パスワード'), { target: { value: password } });
    fireEvent.submit(screen.getByPlaceholderText('メールアドレス').closest('form')!);
    await waitFor(() => expect(h.adminLogin).toHaveBeenCalled());
  }

  it('trims email but not password before adminLogin', async () => {
    h.adminLogin.mockResolvedValue({
      uid: 'admin-1',
      email: 'admin@example.test',
      displayName: 'Admin',
      isAdmin: true,
    });

    render(<AdminLoginScreen onLoginSuccess={h.onLoginSuccess} />);
    await submitLogin('  admin@example.test  ', ' pass word ');

    expect(h.adminLogin).toHaveBeenCalledWith('admin@example.test', ' pass word ');
    await waitFor(() => expect(h.onLoginSuccess).toHaveBeenCalled());
  });

  it('shows invalid_credentials message', async () => {
    h.adminLogin.mockRejectedValue({ code: 'invalid_credentials', message: 'Invalid login credentials' });

    render(<AdminLoginScreen onLoginSuccess={h.onLoginSuccess} />);
    await submitLogin('admin@example.test', 'wrong');

    expect(await screen.findByText(ADMIN_LOGIN_ERROR_MESSAGES.invalidCredentials)).toBeTruthy();
  });

  it('shows admin access denied message', async () => {
    h.adminLogin.mockRejectedValue(new AdminAccessDeniedError());

    render(<AdminLoginScreen onLoginSuccess={h.onLoginSuccess} />);
    await submitLogin('user@example.test', 'secret');

    expect(await screen.findByText(ADMIN_LOGIN_ERROR_MESSAGES.adminAccessDenied)).toBeTruthy();
  });

  it('allows retry after admin access denied', async () => {
    h.adminLogin
      .mockRejectedValueOnce(new AdminAccessDeniedError())
      .mockResolvedValueOnce({
        uid: 'admin-1',
        email: 'admin@example.test',
        displayName: 'Admin',
        isAdmin: true,
      });

    render(<AdminLoginScreen onLoginSuccess={h.onLoginSuccess} />);
    await submitLogin('user@example.test', 'secret');
    expect(await screen.findByText(ADMIN_LOGIN_ERROR_MESSAGES.adminAccessDenied)).toBeTruthy();

    await submitLogin('admin@example.test', 'secret');
    await waitFor(() => expect(h.onLoginSuccess).toHaveBeenCalled());
  });

  it('shows network error message', async () => {
    h.adminLogin.mockRejectedValue(new Error('Failed to fetch'));

    render(<AdminLoginScreen onLoginSuccess={h.onLoginSuccess} />);
    await submitLogin('admin@example.test', 'secret');

    expect(await screen.findByText(ADMIN_LOGIN_ERROR_MESSAGES.network)).toBeTruthy();
  });

  it('shows generic message for unknown errors', async () => {
    h.adminLogin.mockRejectedValue(new Error('unexpected internal failure'));

    render(<AdminLoginScreen onLoginSuccess={h.onLoginSuccess} />);
    await submitLogin('admin@example.test', 'secret');

    expect(await screen.findByText(ADMIN_LOGIN_ERROR_MESSAGES.generic)).toBeTruthy();
  });
});
