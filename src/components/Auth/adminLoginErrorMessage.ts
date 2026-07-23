import { isAdminAccessDeniedError } from '../../core/auth/adminAccessDeniedError';

export const ADMIN_LOGIN_ERROR_MESSAGES = {
  invalidCredentials: 'メールアドレスまたはパスワードが正しくありません',
  adminAccessDenied: 'このアカウントには管理者権限がありません',
  network: '通信に失敗しました。接続を確認して、もう一度お試しください',
  rateLimit: '試行回数が多すぎます。少し時間をおいてお試しください',
  generic: 'ログインに失敗しました。時間をおいてもう一度お試しください',
} as const;

export function normalizeAdminLoginEmail(email: string): string {
  return email.trim();
}

function getErrorCode(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const code = (err as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return '';
}

export function isAdminLoginNetworkError(err: unknown): boolean {
  const message = getErrorMessage(err).toLowerCase();
  return (
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('failed to fetch') ||
    message.includes('networkerror')
  );
}

export function resolveAdminLoginErrorMessage(err: unknown): string {
  if (isAdminAccessDeniedError(err)) {
    return ADMIN_LOGIN_ERROR_MESSAGES.adminAccessDenied;
  }

  const code = getErrorCode(err);
  if (code === 'invalid_credentials') {
    return ADMIN_LOGIN_ERROR_MESSAGES.invalidCredentials;
  }
  if (code === 'over_request_rate_limit' || code === 'too_many_requests') {
    return ADMIN_LOGIN_ERROR_MESSAGES.rateLimit;
  }

  if (isAdminLoginNetworkError(err)) {
    return ADMIN_LOGIN_ERROR_MESSAGES.network;
  }

  return ADMIN_LOGIN_ERROR_MESSAGES.generic;
}
