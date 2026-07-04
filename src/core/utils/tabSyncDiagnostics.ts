import type { Space } from '../types/space';
import type { SpacePane } from '../types/spacePane';
import { getSupabaseProjectHost, isSupabaseConfigured } from '../supabase';
import { splitPanesByFolders } from './spacePaneTabBar';
import type { TabFolder } from './tabFolderStorage';
import {
  loadLegacyLocalTabFolders,
  migrateLegacyLocalTabFoldersIfNeeded,
} from './tabFolderStorage';

export type TabSyncDiagnostics = {
  /** Supabase 接続あり → ローカル dev / デプロイで同一 DB に同期可能 */
  supabaseConfigured: boolean;
  /** 接続先ホスト（local と deploy で一致するか比較用） */
  supabaseHost: string | null;
  /** タブ一覧の保存先 */
  paneStorage: 'supabase:space_panes' | 'localStorage:hossii_demo_space_panes';
  /** フォルダ定義の保存先 */
  folderStorage:
    | 'supabase:spaces.tab_folders'
    | 'localStorage:hossii.tabFolders(legacy)'
    | 'mixed:legacy-pending-migration';
  spaceId: string | null;
  visiblePaneCount: number;
  barPaneCount: number;
  folderCount: number;
  legacyLocalFolderCount: number;
  legacyMigrationPending: boolean;
  /** 人が読める要約（コンソール用） */
  summary: string;
};

type Input = {
  spaceId: string | null;
  space: Space | null | undefined;
  visiblePanes: SpacePane[];
  effectiveFolders: TabFolder[];
};

export function getTabSyncDiagnostics(input: Input): TabSyncDiagnostics {
  const { spaceId, space, visiblePanes, effectiveFolders } = input;
  const { barPanes } = splitPanesByFolders(visiblePanes);
  const legacyLocalFolderCount = spaceId ? loadLegacyLocalTabFolders(spaceId).length : 0;
  const legacyMigrationPending =
    spaceId != null && migrateLegacyLocalTabFoldersIfNeeded(spaceId, space?.tabFolders) != null;

  let folderStorage: TabSyncDiagnostics['folderStorage'];
  if (!isSupabaseConfigured) {
    folderStorage =
      legacyLocalFolderCount > 0 || (space?.tabFolders?.length ?? 0) > 0
        ? 'localStorage:hossii.tabFolders(legacy)'
        : 'localStorage:hossii.tabFolders(legacy)';
  } else if (legacyMigrationPending) {
    folderStorage = 'mixed:legacy-pending-migration';
  } else {
    folderStorage = 'supabase:spaces.tab_folders';
  }

  const supabaseConfigured = isSupabaseConfigured;
  const supabaseHost = getSupabaseProjectHost();

  let summary: string;
  if (!supabaseConfigured) {
    summary =
      'デモモード: タブ・フォルダはこのブラウザの localStorage のみ。npm run dev とデプロイ版は連動しません。VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY を設定してください。';
  } else if (legacyMigrationPending) {
    summary =
      'Supabase 接続済み。旧 localStorage のフォルダ定義が残っています。自動移行が次の保存で走ります。';
  } else {
    summary = `Supabase 接続済み (${supabaseHost ?? '?'})。タブ・フォルダは DB 正本。local / deploy で同じホストなら連動します。`;
  }

  return {
    supabaseConfigured,
    supabaseHost,
    paneStorage: supabaseConfigured
      ? 'supabase:space_panes'
      : 'localStorage:hossii_demo_space_panes',
    folderStorage,
    spaceId,
    visiblePaneCount: visiblePanes.length,
    barPaneCount: barPanes.length,
    folderCount: effectiveFolders.length,
    legacyLocalFolderCount,
    legacyMigrationPending,
    summary,
  };
}

export function logTabSyncDiagnostics(input: Input): TabSyncDiagnostics {
  const diag = getTabSyncDiagnostics(input);
  console.info('[Hossii tab sync]', diag.summary, diag);
  return diag;
}

declare global {
  interface Window {
    __hossiiTabSyncCheck?: () => TabSyncDiagnostics;
  }
}

/** 管理者向け: ブラウザコンソールから `__hossiiTabSyncCheck()` で再確認 */
export function exposeTabSyncCheck(getInput: () => Input): void {
  window.__hossiiTabSyncCheck = () => logTabSyncDiagnostics(getInput());
}
