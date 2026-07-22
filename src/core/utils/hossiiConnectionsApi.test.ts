import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  createConnection,
  deleteConnection,
  fetchConnections,
  normalizeConnectionPair,
  rowToHossiiConnection,
  updateConnectionStrength,
} from './hossiiConnectionsApi';

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock('../supabase', () => ({
  isSupabaseConfigured: true,
  supabase: supabaseMock,
}));

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
    expect(
      rowToHossiiConnection({
        id: 'c1',
        space_id: 's1',
        pane_id: 'p1',
        source_hossii_id: 'a',
        target_hossii_id: 'b',
        strength: 'soft',
        created_by: 'u1',
        created_at: '2026-07-22T00:00:00Z',
        updated_at: '2026-07-22T00:00:00Z',
      }),
    ).toEqual({
      id: 'c1',
      spaceId: 's1',
      paneId: 'p1',
      sourceHossiiId: 'a',
      targetHossiiId: 'b',
      strength: 'soft',
      createdBy: 'u1',
      createdAt: '2026-07-22T00:00:00Z',
      updatedAt: '2026-07-22T00:00:00Z',
    });
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
          id: 'c1',
          space_id: 's1',
          pane_id: 'p1',
          source_hossii_id: 'a',
          target_hossii_id: 'b',
          strength: 'medium',
          created_by: null,
          created_at: 't1',
          updated_at: 't1',
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

  it('normalizes pair before insert', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: {
        id: 'c1',
        space_id: 's1',
        pane_id: 'p1',
        source_hossii_id: 'a',
        target_hossii_id: 'b',
        strength: 'strong',
        created_by: 'u1',
        created_at: 't1',
        updated_at: 't1',
      },
      error: null,
    });
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const insertMock = vi.fn(() => ({ select: selectMock }));
    supabaseMock.from.mockReturnValue({ insert: insertMock });

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
});

describe('updateConnectionStrength', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
  });

  it('returns updated row from server', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: {
        id: 'c1',
        space_id: 's1',
        pane_id: 'p1',
        source_hossii_id: 'a',
        target_hossii_id: 'b',
        strength: 'soft',
        created_by: 'u1',
        created_at: 't1',
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
});
