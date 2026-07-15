import { describe, expect, it, vi } from 'vitest';
import {
  applyArchiveFieldsToSpace,
  mapArchiveRpcRow,
  setSpaceArchived,
} from './spaceArchiveApi';
import {
  isSpaceArchiveWriteBlockedError,
  SPACE_ARCHIVE_WRITE_BLOCKED_MESSAGE,
} from './spaceArchivePolicy';

const supabaseMock = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('../supabase', () => ({
  isSupabaseConfigured: true,
  supabase: supabaseMock,
}));

describe('spaceArchivePolicy', () => {
  it('exposes the shared write-blocked message', () => {
    expect(SPACE_ARCHIVE_WRITE_BLOCKED_MESSAGE).toBe(
      'このスペースはアーカイブされているため変更できません',
    );
    expect(isSpaceArchiveWriteBlockedError(SPACE_ARCHIVE_WRITE_BLOCKED_MESSAGE)).toBe(true);
    expect(isSpaceArchiveWriteBlockedError('other')).toBe(false);
  });
});

describe('mapArchiveRpcRow', () => {
  it('maps snake_case RPC row to camelCase', () => {
    expect(
      mapArchiveRpcRow({
        space_id: 's1',
        is_archived: true,
        archived_at: '2026-07-15T00:00:00.000Z',
        archived_by: 'user-1',
      }),
    ).toEqual({
      spaceId: 's1',
      isArchived: true,
      archivedAt: '2026-07-15T00:00:00.000Z',
      archivedBy: 'user-1',
    });
  });
});

describe('setSpaceArchived', () => {
  it('calls set_space_archived RPC with space id and flag', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: [{ space_id: 's1', is_archived: true, archived_at: 't', archived_by: 'u1' }],
      error: null,
    });

    const res = await setSpaceArchived('s1', true);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('set_space_archived', {
      p_space_id: 's1',
      p_archived: true,
    });
    expect(res).toEqual({
      ok: true,
      spaceId: 's1',
      isArchived: true,
      archivedAt: 't',
      archivedBy: 'u1',
    });
  });

  it('returns error when RPC fails', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'permission denied', code: '42501' },
    });

    const res = await setSpaceArchived('s1', false);
    expect(res).toEqual({ ok: false, message: 'permission denied', code: '42501' });
  });
});

describe('applyArchiveFieldsToSpace', () => {
  it('defaults isArchived to false when omitted', () => {
    const space = applyArchiveFieldsToSpace(
      { id: 's1', name: 'S', quickEmotions: [], createdAt: new Date() },
      {},
    );
    expect(space.isArchived).toBe(false);
  });
});
