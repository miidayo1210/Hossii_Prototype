import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  createConnection,
  deleteConnection,
  fetchConnections,
  normalizeConnectionPair,
  rowToHossiiConnection,
  updateConnectionReason,
  updateConnectionStrength,
} from './hossiiConnectionsApi';

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock('../supabase', () => ({
  isSupabaseConfigured: true,
  supabase: supabaseMock,
}));

const baseRow = {
  id: 'c1',
  space_id: 's1',
  pane_id: 'p1',
  source_hossii_id: 'a',
  target_hossii_id: 'b',
  strength: 'soft' as const,
  created_by: 'u1',
  created_at: '2026-07-22T00:00:00Z',
  updated_at: '2026-07-22T00:00:00Z',
};

describe('normalizeConnectionPair', () => {
  it('sorts ids lexicographically', () => {
    expect(normalizeConnectionPair('z-id', 'a-id')).toEqual({
      sourceHossiiId: 'a-id',
      targetHossiiId: 'z-id',
    });
  });
});

describe('rowToHossiiConnection', () => {
  it('maps snake_case row to camelCase', () => {
    expect(rowToHossiiConnection(baseRow)).toEqual({
      id: 'c1',
      spaceId: 's1',
      paneId: 'p1',
      sourceHossiiId: 'a',
      targetHossiiId: 'b',
      strength: 'soft',
      reasonText: null,
      reasonEmoji: null,
      createdBy: 'u1',
      createdAt: '2026-07-22T00:00:00Z',
      updatedAt: '2026-07-22T00:00:00Z',
    });
  });

  it('maps reason fields when present', () => {
    expect(
      rowToHossiiConnection({
        ...baseRow,
        reason_text: 'つながり',
        reason_emoji: '💡',
      }),
    ).toMatchObject({
      reasonText: 'つながり',
      reasonEmoji: '💡',
    });
  });

  it('maps missing reason columns to null (Production 列未適用互換)', () => {
    expect(rowToHossiiConnection(baseRow).reasonText).toBeNull();
    expect(rowToHossiiConnection(baseRow).reasonEmoji).toBeNull();
  });
});

describe('fetchConnections', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
  });

  it('returns typed connections on success', async () => {
    const orderMock = vi.fn().mockResolvedValue({
      data: [
        {
          ...baseRow,
          strength: 'medium',
          reason_text: '理由',
          reason_emoji: '🔗',
        },
      ],
      error: null,
    });
    const eqPane = vi.fn(() => ({ order: orderMock }));
    const eqSpace = vi.fn(() => ({ eq: eqPane }));
    const select = vi.fn(() => ({ eq: eqSpace }));
    supabaseMock.from.mockReturnValue({ select });

    const res = await fetchConnections('s1', 'p1');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.connections).toHaveLength(1);
      expect(res.connections[0]?.strength).toBe('medium');
      expect(res.connections[0]?.reasonText).toBe('理由');
      expect(res.connections[0]?.reasonEmoji).toBe('🔗');
    }
  });

  it('maps rows without reason columns', async () => {
    const orderMock = vi.fn().mockResolvedValue({
      data: [{ ...baseRow, strength: 'medium' }],
      error: null,
    });
    const eqPane = vi.fn(() => ({ order: orderMock }));
    const eqSpace = vi.fn(() => ({ eq: eqPane }));
    const select = vi.fn(() => ({ eq: eqSpace }));
    supabaseMock.from.mockReturnValue({ select });

    const res = await fetchConnections('s1', 'p1');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.connections[0]?.reasonText).toBeNull();
      expect(res.connections[0]?.reasonEmoji).toBeNull();
    }
  });

  it('surfaces errors without swallowing', async () => {
    const orderMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'permission denied', code: '42501' },
    });
    const eqPane = vi.fn(() => ({ order: orderMock }));
    const eqSpace = vi.fn(() => ({ eq: eqPane }));
    const select = vi.fn(() => ({ eq: eqSpace }));
    supabaseMock.from.mockReturnValue({ select });

    const res = await fetchConnections('s1', 'p1');
    expect(res).toEqual({ ok: false, message: 'permission denied', code: '42501' });
  });
});

describe('createConnection', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
  });

  function mockInsertChain() {
    const singleMock = vi.fn().mockResolvedValue({
      data: baseRow,
      error: null,
    });
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const insertMock = vi.fn(() => ({ select: selectMock }));
    supabaseMock.from.mockReturnValue({ insert: insertMock });
    return insertMock;
  }

  it('normalizes pair before insert', async () => {
    const insertMock = mockInsertChain();

    const res = await createConnection({
      spaceId: 's1',
      paneId: 'p1',
      sourceHossiiId: 'b',
      targetHossiiId: 'a',
      strength: 'strong',
    });

    expect(insertMock).toHaveBeenCalledWith({
      space_id: 's1',
      pane_id: 'p1',
      source_hossii_id: 'a',
      target_hossii_id: 'b',
      strength: 'strong',
    });
    expect(res.ok).toBe(true);
  });

  it('reasonなし create では reason 列を送らない', async () => {
    const insertMock = mockInsertChain();

    await createConnection({
      spaceId: 's1',
      paneId: 'p1',
      sourceHossiiId: 'a',
      targetHossiiId: 'b',
      strength: 'soft',
    });

    expect(insertMock.mock.calls[0]?.[0]).not.toHaveProperty('reason_text');
    expect(insertMock.mock.calls[0]?.[0]).not.toHaveProperty('reason_emoji');
  });

  it('reasonあり create で正規化して insert する', async () => {
    const insertMock = mockInsertChain();

    const res = await createConnection({
      spaceId: 's1',
      paneId: 'p1',
      sourceHossiiId: 'a',
      targetHossiiId: 'b',
      strength: 'soft',
      reasonText: '  つながり  ',
      reasonEmoji: '💡',
    });

    expect(insertMock).toHaveBeenCalledWith({
      space_id: 's1',
      pane_id: 'p1',
      source_hossii_id: 'a',
      target_hossii_id: 'b',
      strength: 'soft',
      reason_text: 'つながり',
      reason_emoji: '💡',
    });
    expect(res.ok).toBe(true);
  });

  it('空白 reasonText は NULL として insert する', async () => {
    const insertMock = mockInsertChain();

    await createConnection({
      spaceId: 's1',
      paneId: 'p1',
      sourceHossiiId: 'a',
      targetHossiiId: 'b',
      strength: 'soft',
      reasonText: '   ',
    });

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        reason_text: null,
        reason_emoji: null,
      }),
    );
  });

  it('51文字 reasonText を拒否', async () => {
    const res = await createConnection({
      spaceId: 's1',
      paneId: 'p1',
      sourceHossiiId: 'a',
      targetHossiiId: 'b',
      strength: 'soft',
      reasonText: 'あ'.repeat(51),
    });
    expect(res).toEqual({
      ok: false,
      message: 'reason text must be at most 50 characters',
    });
  });

  it('surfaces Supabase insert errors', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'check violation', code: '23514' },
    });
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const insertMock = vi.fn(() => ({ select: selectMock }));
    supabaseMock.from.mockReturnValue({ insert: insertMock });

    const res = await createConnection({
      spaceId: 's1',
      paneId: 'p1',
      sourceHossiiId: 'a',
      targetHossiiId: 'b',
      strength: 'soft',
      reasonText: 'ok',
    });
    expect(res).toEqual({ ok: false, message: 'check violation', code: '23514' });
  });
});

describe('updateConnectionStrength', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
  });

  it('returns updated row from server', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: {
        ...baseRow,
        strength: 'soft',
        updated_at: 't2',
      },
      error: null,
    });
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const eqMock = vi.fn(() => ({ select: selectMock }));
    const updateMock = vi.fn(() => ({ eq: eqMock }));
    supabaseMock.from.mockReturnValue({ update: updateMock });

    const res = await updateConnectionStrength('c1', 'soft');
    expect(updateMock).toHaveBeenCalledWith({ strength: 'soft' });
    expect(res.ok).toBe(true);
  });

  it('does not touch reason fields (regression)', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: baseRow,
      error: null,
    });
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const eqMock = vi.fn(() => ({ select: selectMock }));
    const updateMock = vi.fn(() => ({ eq: eqMock }));
    supabaseMock.from.mockReturnValue({ update: updateMock });

    await updateConnectionStrength('c1', 'medium');
    expect(updateMock).toHaveBeenCalledWith({ strength: 'medium' });
    expect(updateMock.mock.calls[0]?.[0]).not.toHaveProperty('reason_text');
  });
});

describe('updateConnectionReason', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
  });

  it('updates reason fields', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: {
        ...baseRow,
        reason_text: '更新',
        reason_emoji: '🌱',
      },
      error: null,
    });
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const eqMock = vi.fn(() => ({ select: selectMock }));
    const updateMock = vi.fn(() => ({ eq: eqMock }));
    supabaseMock.from.mockReturnValue({ update: updateMock });

    const res = await updateConnectionReason({
      connectionId: 'c1',
      reasonText: '更新',
      reasonEmoji: '🌱',
    });

    expect(updateMock).toHaveBeenCalledWith({
      reason_text: '更新',
      reason_emoji: '🌱',
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.connection.reasonText).toBe('更新');
      expect(res.connection.reasonEmoji).toBe('🌱');
    }
  });

  it('rejects invalid reason before Supabase call', async () => {
    const updateMock = vi.fn();
    supabaseMock.from.mockReturnValue({ update: updateMock });

    const res = await updateConnectionReason({
      connectionId: 'c1',
      reasonText: 'a'.repeat(51),
    });
    expect(res).toEqual({
      ok: false,
      message: 'reason text must be at most 50 characters',
    });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('surfaces Supabase update errors', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'permission denied', code: '42501' },
    });
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const eqMock = vi.fn(() => ({ select: selectMock }));
    const updateMock = vi.fn(() => ({ eq: eqMock }));
    supabaseMock.from.mockReturnValue({ update: updateMock });

    const res = await updateConnectionReason({
      connectionId: 'c1',
      reasonEmoji: '❤️',
    });
    expect(updateMock).toHaveBeenCalledWith({ reason_emoji: '❤️' });
    expect(res).toEqual({ ok: false, message: 'permission denied', code: '42501' });
  });

  it('text だけ更新 → emoji を payload に含めない', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: { ...baseRow, reason_text: '更新' },
      error: null,
    });
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const eqMock = vi.fn(() => ({ select: selectMock }));
    const updateMock = vi.fn(() => ({ eq: eqMock }));
    supabaseMock.from.mockReturnValue({ update: updateMock });

    await updateConnectionReason({ connectionId: 'c1', reasonText: '更新' });

    expect(updateMock).toHaveBeenCalledWith({ reason_text: '更新' });
    expect(updateMock.mock.calls[0]?.[0]).not.toHaveProperty('reason_emoji');
  });

  it('emoji だけ更新 → text を payload に含めない', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: { ...baseRow, reason_emoji: '❤️' },
      error: null,
    });
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const eqMock = vi.fn(() => ({ select: selectMock }));
    const updateMock = vi.fn(() => ({ eq: eqMock }));
    supabaseMock.from.mockReturnValue({ update: updateMock });

    await updateConnectionReason({ connectionId: 'c1', reasonEmoji: '❤️' });

    expect(updateMock).toHaveBeenCalledWith({ reason_emoji: '❤️' });
    expect(updateMock.mock.calls[0]?.[0]).not.toHaveProperty('reason_text');
  });

  it('text を null → text だけ clear', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: { ...baseRow, reason_text: null },
      error: null,
    });
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const eqMock = vi.fn(() => ({ select: selectMock }));
    const updateMock = vi.fn(() => ({ eq: eqMock }));
    supabaseMock.from.mockReturnValue({ update: updateMock });

    await updateConnectionReason({ connectionId: 'c1', reasonText: null });

    expect(updateMock).toHaveBeenCalledWith({ reason_text: null });
    expect(updateMock.mock.calls[0]?.[0]).not.toHaveProperty('reason_emoji');
  });

  it('emoji を null → emoji だけ clear', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: { ...baseRow, reason_emoji: null },
      error: null,
    });
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const eqMock = vi.fn(() => ({ select: selectMock }));
    const updateMock = vi.fn(() => ({ eq: eqMock }));
    supabaseMock.from.mockReturnValue({ update: updateMock });

    await updateConnectionReason({ connectionId: 'c1', reasonEmoji: null });

    expect(updateMock).toHaveBeenCalledWith({ reason_emoji: null });
    expect(updateMock.mock.calls[0]?.[0]).not.toHaveProperty('reason_text');
  });

  it('両方 null → 両方 clear', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: { ...baseRow, reason_text: null, reason_emoji: null },
      error: null,
    });
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const eqMock = vi.fn(() => ({ select: selectMock }));
    const updateMock = vi.fn(() => ({ eq: eqMock }));
    supabaseMock.from.mockReturnValue({ update: updateMock });

    await updateConnectionReason({
      connectionId: 'c1',
      reasonText: null,
      reasonEmoji: null,
    });

    expect(updateMock).toHaveBeenCalledWith({
      reason_text: null,
      reason_emoji: null,
    });
  });

  it('両方 undefined → API を呼ばず拒否', async () => {
    const updateMock = vi.fn();
    supabaseMock.from.mockReturnValue({ update: updateMock });

    const res = await updateConnectionReason({ connectionId: 'c1' });

    expect(res).toEqual({
      ok: false,
      message: 'reasonText or reasonEmoji is required',
    });
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe('deleteConnection', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
  });

  it('returns id on success', async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null });
    const deleteMock = vi.fn(() => ({ eq: eqMock }));
    supabaseMock.from.mockReturnValue({ delete: deleteMock });

    const res = await deleteConnection('c1');
    expect(res).toEqual({ ok: true, id: 'c1' });
  });

  /**
   * Supabase delete は 0 件でも error を返さない。
   * deleteConnection は deleted count を見ないため、存在しない id でも { ok: true, id } になる。
   * UI 側で「削除済み」扱いにする場合は fetch 再同期か count チェックが別途必要。
   */
  it('returns ok when zero rows deleted (no Supabase error)', async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null, count: 0 });
    const deleteMock = vi.fn(() => ({ eq: eqMock }));
    supabaseMock.from.mockReturnValue({ delete: deleteMock });

    const res = await deleteConnection('missing-id');
    expect(res).toEqual({ ok: true, id: 'missing-id' });
  });

  it('surfaces delete errors', async () => {
    const eqMock = vi.fn().mockResolvedValue({
      error: { message: 'permission denied', code: '42501' },
    });
    const deleteMock = vi.fn(() => ({ eq: eqMock }));
    supabaseMock.from.mockReturnValue({ delete: deleteMock });

    const res = await deleteConnection('c1');
    expect(res).toEqual({ ok: false, message: 'permission denied', code: '42501' });
  });
});
