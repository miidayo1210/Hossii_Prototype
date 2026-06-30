export const DEFAULT_FOLDER_ID = 'default';
export const DEFAULT_FOLDER_NAME = 'カゴ';

export type TabFolder = {
  id: string;
  name: string;
  sortOrder: number;
};

export const DEFAULT_FOLDER: TabFolder = {
  id: DEFAULT_FOLDER_ID,
  name: DEFAULT_FOLDER_NAME,
  sortOrder: 0,
};

const FOLDERS_KEY = (id: string) => `hossii.tabFolders:${id}`;
const OPEN_KEY = (spaceId: string, folderId: string) =>
  `hossii.tabFolderOpen:${spaceId}:${folderId}`;

export function loadTabFolders(spaceId: string): TabFolder[] {
  try {
    const raw = localStorage.getItem(FOLDERS_KEY(spaceId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TabFolder[]) : [];
  } catch {
    return [];
  }
}

export function saveTabFolders(spaceId: string, folders: TabFolder[]): void {
  try {
    if (folders.length === 0) {
      localStorage.removeItem(FOLDERS_KEY(spaceId));
    } else {
      localStorage.setItem(FOLDERS_KEY(spaceId), JSON.stringify(folders));
    }
  } catch {
    // ignore
  }
}

export function loadTabFolderOpen(spaceId: string, folderId: string): boolean {
  try {
    // Migrate from 100B single-basket key for the default folder
    if (folderId === DEFAULT_FOLDER_ID) {
      const legacy = localStorage.getItem(`hossii.tabBasketOpen:${spaceId}`);
      if (legacy !== null) return legacy === '1';
    }
    return localStorage.getItem(OPEN_KEY(spaceId, folderId)) === '1';
  } catch {
    return false;
  }
}

export function saveTabFolderOpen(spaceId: string, folderId: string, open: boolean): void {
  try {
    localStorage.setItem(OPEN_KEY(spaceId, folderId), open ? '1' : '0');
  } catch {
    // ignore
  }
}
