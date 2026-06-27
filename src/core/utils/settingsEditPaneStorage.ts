const STORAGE_PREFIX = 'hossii.settingsEditPaneId';

export function settingsEditPaneStorageKey(spaceId: string): string {
  return `${STORAGE_PREFIX}.${spaceId}`;
}

export function loadSettingsEditPaneId(spaceId: string): string | null {
  try {
    return sessionStorage.getItem(settingsEditPaneStorageKey(spaceId));
  } catch {
    return null;
  }
}

export function saveSettingsEditPaneId(spaceId: string, paneId: string): void {
  try {
    sessionStorage.setItem(settingsEditPaneStorageKey(spaceId), paneId);
  } catch {
    // ignore quota errors
  }
}
