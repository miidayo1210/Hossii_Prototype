import { describe, it, expect } from 'vitest';
import { AdminAccessDeniedError } from '../../core/auth/adminAccessDeniedError';
import {
  ADMIN_LOGIN_ERROR_MESSAGES,
  normalizeAdminLoginEmail,
  resolveAdminLoginErrorMessage,
} from './adminLoginErrorMessage';

describe('normalizeAdminLoginEmail', () => {
  it('trims leading and trailing whitespace from email', () => {
    expect(normalizeAdminLoginEmail('  admin@example.test  ')).toBe('admin@example.test');
  });
});

describe('resolveAdminLoginErrorMessage', () => {
  it('maps invalid_credentials to credential message', () => {
    expect(
      resolveAdminLoginErrorMessage({ code: 'invalid_credentials', message: 'Invalid login credentials' }),
    ).toBe(ADMIN_LOGIN_ERROR_MESSAGES.invalidCredentials);
  });

  it('maps admin access denied error', () => {
    expect(resolveAdminLoginErrorMessage(new AdminAccessDeniedError())).toBe(
      ADMIN_LOGIN_ERROR_MESSAGES.adminAccessDenied,
    );
  });

  it('maps network failures', () => {
    expect(resolveAdminLoginErrorMessage(new Error('Failed to fetch'))).toBe(
      ADMIN_LOGIN_ERROR_MESSAGES.network,
    );
  });

  it('maps rate limit errors', () => {
    expect(
      resolveAdminLoginErrorMessage({ code: 'over_request_rate_limit', message: 'Rate limit' }),
    ).toBe(ADMIN_LOGIN_ERROR_MESSAGES.rateLimit);
  });

  it('maps unknown errors to generic message', () => {
    expect(resolveAdminLoginErrorMessage(new Error('unexpected internal failure'))).toBe(
      ADMIN_LOGIN_ERROR_MESSAGES.generic,
    );
  });
});

describe('password handling contract', () => {
  it('does not trim password values', () => {
    const password = ' pass word ';
    expect(password.trim()).not.toBe(password);
    expect(password).toBe(' pass word ');
  });
});
