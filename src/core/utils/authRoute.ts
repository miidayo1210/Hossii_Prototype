/** pathname ベースの認証ルート（/login, /signup, /admin/login） */

export type AuthAppRoute = 'admin-login' | 'login' | 'signup' | 'default';

export const AUTH_ROUTE_CHANGE_EVENT = 'hossii:auth-route-change';

export function normalizePathname(pathname: string): string {
  if (pathname === '/') return '/';
  return pathname.replace(/\/+$/, '');
}

export function pathnameToAppRoute(pathname: string): AuthAppRoute {
  const p = normalizePathname(pathname);
  if (p === '/admin/login') return 'admin-login';
  if (p === '/login') return 'login';
  if (p === '/signup') return 'signup';
  return 'default';
}

export type PersonalAuthRoute = 'login' | 'signup';

export function personalAuthRouteToPath(route: PersonalAuthRoute): string {
  return route === 'login' ? '/login' : '/signup';
}

function dispatchAuthRouteChange(): void {
  window.dispatchEvent(new CustomEvent(AUTH_ROUTE_CHANGE_EVENT));
}

/** pathname を変更し、App.tsx が appRoute を同期できるようイベントを発火する */
export function navigateAuthRoute(
  route: AuthAppRoute,
  method: 'push' | 'replace' = 'push',
): void {
  const path =
    route === 'admin-login'
      ? '/admin/login'
      : route === 'login'
        ? '/login'
        : route === 'signup'
          ? '/signup'
          : '/';

  if (method === 'replace') {
    window.history.replaceState({}, '', path);
  } else {
    window.history.pushState({}, '', path);
  }
  dispatchAuthRouteChange();
}

export function navigatePersonalAuth(
  mode: PersonalAuthRoute,
  method: 'push' | 'replace' = 'push',
): void {
  navigateAuthRoute(mode, method);
}
