import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Space } from '../types/space';
import {
  areAllVisiblePersonalSpacesSelected,
  buildBulkPersonalArchiveConfirmMessage,
  formatBulkPersonalArchiveResultMessage,
  isPartialPersonalSpaceSelection,
  partitionBulkPersonalArchiveTargets,
  runBulkPersonalSpaceArchive,
} from './adminPersonalSpaceBulkArchive';

const supabaseMock = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('../supabase', () => ({
  isSupabaseConfigured: true,
  supabase: supabaseMock,
}));

function space(partial: Partial<Space> & Pick<Space, 'id' | 'name'>): Space {
  return {
    quickEmotions: [],
    createdAt: new Date('2026-01-01'),
    spaceType: 'personal',
    ...partial,
  };
}

describe('partitionBulkPersonalArchiveTargets', () => {
  const visible = [
    space({ id: 'a1', name: 'Active 1', isArchived: false }),
    space({ id: 'a2', name: 'Active 2', isArchived: false }),
    space({ id: 'ar1', name: 'Archived 1', isArchived: true }),
  ];

  it('archive は active のみ actionable', () => {
    const selected = new Set(['a1', 'ar1', 'missing']);
    const result = partitionBulkPersonalArchiveTargets(visible, selected, 'archive');
    expect(result.actionable.map((s) => s.id)).toEqual(['a1']);
    expect(result.skippedWrongState.map((s) => s.id)).toEqual(['ar1']);
  });

  it('unarchive は archived のみ actionable', () => {
    const selected = new Set(['a2', 'ar1']);
    const result = partitionBulkPersonalArchiveTargets(visible, selected, 'unarchive');
    expect(result.actionable.map((s) => s.id)).toEqual(['ar1']);
    expect(result.skippedWrongState.map((s) => s.id)).toEqual(['a2']);
  });

  it('表示中リスト外の選択 ID は無視する', () => {
    const selected = new Set(['a1', 'hidden']);
    const result = partitionBulkPersonalArchiveTargets(visible, selected, 'archive');
    expect(result.actionable.map((s) => s.id)).toEqual(['a1']);
  });
});

describe('buildBulkPersonalArchiveConfirmMessage', () => {
  it('アーカイブ確認に件数と説明を含める', () => {
    const partition = {
      actionable: [space({ id: 'a', name: 'A' })],
      skippedWrongState: [space({ id: 'b', name: 'B', isArchived: true })],
    };
    const msg = buildBulkPersonalArchiveConfirmMessage(partition, 'archive');
    expect(msg).toContain('選択した1件をアーカイブしますか？');
    expect(msg).toContain('削除ではありません');
    expect(msg).toContain('1件はすでにアーカイブ済み');
  });

  it('解除確認メッセージ', () => {
    const partition = {
      actionable: [space({ id: 'a', name: 'A', isArchived: true })],
      skippedWrongState: [],
    };
    const msg = buildBulkPersonalArchiveConfirmMessage(partition, 'unarchive');
    expect(msg).toContain('選択した1件のアーカイブを解除しますか？');
  });
});

describe('formatBulkPersonalArchiveResultMessage', () => {
  it('成功件数を表示する', () => {
    const msg = formatBulkPersonalArchiveResultMessage({
      operation: 'archive',
      successCount: 2,
      failureCount: 0,
      skippedWrongStateCount: 0,
      failures: [],
      successfulPatches: [],
    });
    expect(msg).toBe('2件をアーカイブしました。');
  });

  it('失敗したスペース名を表示する', () => {
    const msg = formatBulkPersonalArchiveResultMessage({
      operation: 'archive',
      successCount: 1,
      failureCount: 1,
      skippedWrongStateCount: 0,
      failures: [{ spaceId: 'x', spaceName: '失敗スペース', message: 'denied' }],
      successfulPatches: [],
    });
    expect(msg).toContain('1件をアーカイブしました');
    expect(msg).toContain('失敗スペース');
  });
});

describe('selection helpers', () => {
  const visible = [
    space({ id: 'a1', name: 'A' }),
    space({ id: 'a2', name: 'B' }),
  ];

  it('全選択判定', () => {
    expect(areAllVisiblePersonalSpacesSelected(visible, new Set(['a1', 'a2']))).toBe(true);
    expect(areAllVisiblePersonalSpacesSelected(visible, new Set(['a1']))).toBe(false);
    expect(areAllVisiblePersonalSpacesSelected([], new Set())).toBe(false);
  });

  it('一部選択判定', () => {
    expect(isPartialPersonalSpaceSelection(visible, new Set(['a1']))).toBe(true);
    expect(isPartialPersonalSpaceSelection(visible, new Set(['a1', 'a2']))).toBe(false);
    expect(isPartialPersonalSpaceSelection(visible, new Set())).toBe(false);
  });
});

describe('runBulkPersonalSpaceArchive', () => {
  beforeEach(() => {
    supabaseMock.rpc.mockReset();
  });

  it('順次 RPC を呼び、成功 patch を返す', async () => {
    supabaseMock.rpc
      .mockResolvedValueOnce({
        data: [{ space_id: 's1', is_archived: true, archived_at: 't1', archived_by: 'u1' }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ space_id: 's2', is_archived: true, archived_at: 't2', archived_by: 'u1' }],
        error: null,
      });

    const result = await runBulkPersonalSpaceArchive(
      [
        space({ id: 's1', name: 'One' }),
        space({ id: 's2', name: 'Two' }),
      ],
      'archive',
    );

    expect(supabaseMock.rpc).toHaveBeenCalledTimes(2);
    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(0);
    expect(result.successfulPatches).toHaveLength(2);
    expect(result.successfulPatches[0].patch.isArchived).toBe(true);
  });

  it('一部失敗しても残りを継続する', async () => {
    supabaseMock.rpc
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'permission denied' },
      })
      .mockResolvedValueOnce({
        data: [{ space_id: 's2', is_archived: true, archived_at: 't', archived_by: 'u1' }],
        error: null,
      });

    const result = await runBulkPersonalSpaceArchive(
      [
        space({ id: 's1', name: 'Fail Space' }),
        space({ id: 's2', name: 'OK Space' }),
      ],
      'archive',
    );

    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(1);
    expect(result.failures[0].spaceName).toBe('Fail Space');
  });

  it('同じ space を重複処理しない', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: [{ space_id: 's1', is_archived: false, archived_at: null, archived_by: null }],
      error: null,
    });

    const dup = space({ id: 's1', name: 'Dup', isArchived: true });
    const result = await runBulkPersonalSpaceArchive([dup, dup], 'unarchive');
    expect(supabaseMock.rpc).toHaveBeenCalledTimes(1);
    expect(result.successCount).toBe(1);
  });
});
