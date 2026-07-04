import { describe, expect, it, vi } from 'vitest';
import type { Space } from '../types/space';
import { getTabSyncDiagnostics } from './tabSyncDiagnostics';

vi.mock('../supabase', () => ({
  isSupabaseConfigured: true,
  getSupabaseProjectHost: () => 'example.supabase.co',
}));

describe('getTabSyncDiagnostics', () => {
  const space: Space = {
    id: 'space-1',
    name: 'Test',
    quickEmotions: ['joy'],
    createdAt: new Date(),
    tabFolders: [{ id: 'f1', name: 'Spring', sortOrder: 0 }],
  };

  it('reports supabase storage when configured', () => {
    const diag = getTabSyncDiagnostics({
      spaceId: 'space-1',
      space,
      visiblePanes: [],
      effectiveFolders: space.tabFolders!,
    });
    expect(diag.supabaseConfigured).toBe(true);
    expect(diag.supabaseHost).toBe('example.supabase.co');
    expect(diag.paneStorage).toBe('supabase:space_panes');
    expect(diag.folderStorage).toBe('supabase:spaces.tab_folders');
  });
});
