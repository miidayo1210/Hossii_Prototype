const STORAGE_PREFIX = 'hossii.myHossiiPromptDismissed.';

export function myHossiiPromptStorageKey(userId: string, spaceId: string): string {
  return `${STORAGE_PREFIX}${userId}.${spaceId}`;
}

export function isMyHossiiPromptDismissed(userId: string, spaceId: string): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(myHossiiPromptStorageKey(userId, spaceId)) === '1';
}

export function dismissMyHossiiPrompt(userId: string, spaceId: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(myHossiiPromptStorageKey(userId, spaceId), '1');
}

/** @internal テスト用 */
export { STORAGE_PREFIX as MY_HOSSII_PROMPT_STORAGE_PREFIX };
