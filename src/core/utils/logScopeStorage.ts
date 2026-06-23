export type LogScope = 'all' | 'mine';

const STORAGE_KEY = 'hossii.logScope';

export function loadLogScope(): LogScope {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'all' || raw === 'mine') return raw;
    return 'all';
  } catch {
    return 'all';
  }
}

export function saveLogScope(scope: LogScope): void {
  try {
    localStorage.setItem(STORAGE_KEY, scope);
  } catch {
    // ignore
  }
}
