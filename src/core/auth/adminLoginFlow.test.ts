import { describe, it, expect, vi } from 'vitest';
import {
  revokeSessionAfterAdminAccessDenied,
  shouldBlockAdminLoginScreen,
} from './adminLoginFlow';

describe('shouldBlockAdminLoginScreen', () => {
  it('blocks only during initial auth bootstrap before any user is known', () => {
    expect(shouldBlockAdminLoginScreen(true, null)).toBe(true);
  });

  it('blocks for admin users awaiting redirect', () => {
    expect(shouldBlockAdminLoginScreen(false, { isAdmin: true })).toBe(true);
  });

  it('keeps admin login form visible after signOut auth resolving (access denied)', () => {
    expect(shouldBlockAdminLoginScreen(false, null)).toBe(false);
  });

  it('keeps admin login form visible for resolved non-admin during auth resolving', () => {
    expect(shouldBlockAdminLoginScreen(true, { isAdmin: false })).toBe(false);
  });
});

describe('revokeSessionAfterAdminAccessDenied', () => {
  it('signs out, clears community selection, and clears current user', async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    const clearStoredCommunityId = vi.fn();
    const clearCurrentUser = vi.fn();
    const logSignOutFailure = vi.fn();

    await revokeSessionAfterAdminAccessDenied({
      signOut,
      clearStoredCommunityId,
      clearCurrentUser,
      logSignOutFailure,
    });

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(clearStoredCommunityId).toHaveBeenCalledTimes(1);
    expect(clearCurrentUser).toHaveBeenCalledTimes(1);
    expect(logSignOutFailure).not.toHaveBeenCalled();
  });

  it('still clears local state when signOut returns an error', async () => {
    const signOut = vi.fn().mockResolvedValue({ error: { message: 'network' } });
    const clearStoredCommunityId = vi.fn();
    const clearCurrentUser = vi.fn();
    const logSignOutFailure = vi.fn();

    await revokeSessionAfterAdminAccessDenied({
      signOut,
      clearStoredCommunityId,
      clearCurrentUser,
      logSignOutFailure,
    });

    expect(logSignOutFailure).toHaveBeenCalledTimes(1);
    expect(clearStoredCommunityId).toHaveBeenCalledTimes(1);
    expect(clearCurrentUser).toHaveBeenCalledTimes(1);
  });

  it('still clears local state when signOut throws', async () => {
    const signOut = vi.fn().mockRejectedValue(new Error('boom'));
    const clearStoredCommunityId = vi.fn();
    const clearCurrentUser = vi.fn();
    const logSignOutFailure = vi.fn();

    await revokeSessionAfterAdminAccessDenied({
      signOut,
      clearStoredCommunityId,
      clearCurrentUser,
      logSignOutFailure,
    });

    expect(logSignOutFailure).toHaveBeenCalledTimes(1);
    expect(clearCurrentUser).toHaveBeenCalledTimes(1);
  });
});
