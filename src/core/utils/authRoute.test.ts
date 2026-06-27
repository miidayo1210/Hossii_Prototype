import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
  AUTH_ROUTE_CHANGE_EVENT,
  navigateAuthRoute,
  navigatePersonalAuth,
  normalizePathname,
  pathnameToAppRoute,
  personalAuthRouteToPath,
} from './authRoute';

const here = dirname(fileURLToPath(import.meta.url));

describe('normalizePathname', () => {
  it('keeps root as /', () => {
    expect(normalizePathname('/')).toBe('/');
  });

  it('strips trailing slashes', () => {
    expect(normalizePathname('/login/')).toBe('/login');
    expect(normalizePathname('/signup/')).toBe('/signup');
    expect(normalizePathname('/admin/login/')).toBe('/admin/login');
  });
});

describe('pathnameToAppRoute', () => {
  it('maps personal auth paths', () => {
    expect(pathnameToAppRoute('/login')).toBe('login');
    expect(pathnameToAppRoute('/login/')).toBe('login');
    expect(pathnameToAppRoute('/signup')).toBe('signup');
    expect(pathnameToAppRoute('/signup/')).toBe('signup');
  });

  it('maps admin login', () => {
    expect(pathnameToAppRoute('/admin/login')).toBe('admin-login');
    expect(pathnameToAppRoute('/admin/login/')).toBe('admin-login');
  });

  it('returns default for other paths', () => {
    expect(pathnameToAppRoute('/')).toBe('default');
    expect(pathnameToAppRoute('/s/example')).toBe('default');
    expect(pathnameToAppRoute('/c/foo/s/bar')).toBe('default');
  });
});

describe('personalAuthRouteToPath', () => {
  it('returns login and signup paths', () => {
    expect(personalAuthRouteToPath('login')).toBe('/login');
    expect(personalAuthRouteToPath('signup')).toBe('/signup');
  });
});

describe('navigateAuthRoute', () => {
  it('updates pathname and dispatches route change event', () => {
    const listeners: Array<() => void> = [];
    const pushState = vi.fn();
    const dispatchEvent = vi.fn((event: Event) => {
      if (event.type === AUTH_ROUTE_CHANGE_EVENT) {
        listeners.forEach((listener) => listener());
      }
    });

    vi.stubGlobal('window', {
      history: { pushState, replaceState: vi.fn() },
      location: { pathname: '/' },
      addEventListener: (_: string, listener: () => void) => {
        listeners.push(listener);
      },
      dispatchEvent,
    });

    navigateAuthRoute('login');
    expect(pushState).toHaveBeenCalledWith({}, '', '/login');
    expect(dispatchEvent).toHaveBeenCalled();

    navigatePersonalAuth('signup', 'replace');
    expect(window.history.replaceState).toHaveBeenCalledWith({}, '', '/signup');

    vi.unstubAllGlobals();
  });
});

describe('StartScreen auth entry copy', () => {
  const src = readFileSync(
    join(here, '../../components/StartScreen/StartScreen.tsx'),
    'utf8',
  );

  it('exposes login and signup entry points', () => {
    expect(src).toContain('アカウントでログイン');
    expect(src).toContain('新規登録');
    expect(src).toContain("navigateAuthRoute('login')");
    expect(src).toContain("navigateAuthRoute('signup')");
  });

  it('does not show coming soon or create-space copy', () => {
    expect(src).not.toContain('Coming soon');
    expect(src).not.toContain('スペースを作る');
  });
});

describe('GuestEntry auth handlers in App', () => {
  const src = readFileSync(join(here, '../../App.tsx'), 'utf8');

  it('navigates to auth routes from guest entry handlers', () => {
    expect(src).toContain('handleGuestLoginRequested');
    expect(src).toContain("navigateAuthRoute('login')");
    expect(src).toContain("navigateAuthRoute('signup')");
    expect(src).toContain('captureAuthReturnTarget()');
  });

  it('evaluates auth routes before GuestEntryScreen', () => {
    const loginRouteIdx = src.indexOf("appRoute === 'login' || appRoute === 'signup'");
    const pendingAuthIdx = src.indexOf('pendingLoginSlug');
    const guestEntryIdx = src.indexOf('<GuestEntryScreen');
    expect(loginRouteIdx).toBeGreaterThan(-1);
    expect(pendingAuthIdx).toBeGreaterThan(-1);
    expect(guestEntryIdx).toBeGreaterThan(-1);
    expect(loginRouteIdx).toBeLessThan(guestEntryIdx);
    expect(pendingAuthIdx).toBeLessThan(guestEntryIdx);
  });
});

describe('LoginScreen signup fields', () => {
  const src = readFileSync(
    join(here, '../../components/Auth/LoginScreen.tsx'),
    'utf8',
  );

  it('hides birthdate and gender inputs', () => {
    expect(src).not.toContain('生年月日');
    expect(src).not.toContain('性別（任意）');
    expect(src).toContain('表示名（必須）');
  });

  it('syncs mode with pathname', () => {
    expect(src).toContain('navigatePersonalAuth');
  });
});
