// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useHossiiConnections } from './useHossiiConnections';

const fetchConnectionsMock = vi.hoisted(() => vi.fn());

vi.mock('../utils/hossiiConnectionsApi', () => ({
  fetchConnections: fetchConnectionsMock,
}));

vi.mock('../supabase', () => ({
  isSupabaseConfigured: true,
}));

describe('useHossiiConnections', () => {
  beforeEach(() => {
    fetchConnectionsMock.mockReset();
  });

  it('does not fetch when disabled', async () => {
    renderHook(() =>
      useHossiiConnections({ spaceId: 's1', paneId: 'p1', enabled: false }),
    );
    await waitFor(() => {
      expect(fetchConnectionsMock).not.toHaveBeenCalled();
    });
  });

  it('loads connections for enabled pane', async () => {
    fetchConnectionsMock.mockResolvedValue({
      ok: true,
      connections: [
        {
          id: 'c1',
          spaceId: 's1',
          paneId: 'p1',
          sourceHossiiId: 'a',
          targetHossiiId: 'b',
          strength: 'soft',
          createdBy: null,
          createdAt: 't1',
          updatedAt: 't1',
        },
      ],
    });

    const { result } = renderHook(() =>
      useHossiiConnections({ spaceId: 's1', paneId: 'p1', enabled: true }),
    );

    await waitFor(() => {
      expect(result.current.connections).toHaveLength(1);
    });
  });

  it('falls back to empty array on fetch failure', async () => {
    fetchConnectionsMock.mockResolvedValue({
      ok: false,
      message: 'network error',
    });

    const { result } = renderHook(() =>
      useHossiiConnections({ spaceId: 's1', paneId: 'p1', enabled: true }),
    );

    await waitFor(() => {
      expect(result.current.connections).toEqual([]);
    });
  });

  it('clears connections when pane changes', async () => {
    fetchConnectionsMock.mockResolvedValue({ ok: true, connections: [] });

    const { result, rerender } = renderHook(
      ({ paneId }: { paneId: string }) =>
        useHossiiConnections({ spaceId: 's1', paneId, enabled: true }),
      { initialProps: { paneId: 'p1' } },
    );

    await waitFor(() => {
      expect(fetchConnectionsMock).toHaveBeenCalledWith('s1', 'p1');
    });

    fetchConnectionsMock.mockResolvedValue({
      ok: true,
      connections: [
        {
          id: 'c2',
          spaceId: 's1',
          paneId: 'p2',
          sourceHossiiId: 'x',
          targetHossiiId: 'y',
          strength: 'medium',
          createdBy: null,
          createdAt: 't2',
          updatedAt: 't2',
        },
      ],
    });

    rerender({ paneId: 'p2' });

    await waitFor(() => {
      expect(fetchConnectionsMock).toHaveBeenCalledWith('s1', 'p2');
      expect(result.current.connections).toHaveLength(1);
    });
  });

  it('clears stale connections immediately when pane changes before fetch resolves', async () => {
    fetchConnectionsMock.mockResolvedValueOnce({
      ok: true,
      connections: [
        {
          id: 'c-old',
          spaceId: 's1',
          paneId: 'p1',
          sourceHossiiId: 'a',
          targetHossiiId: 'b',
          strength: 'soft',
          createdBy: null,
          createdAt: 't1',
          updatedAt: 't1',
        },
      ],
    });

    const { result, rerender } = renderHook(
      ({ paneId }: { paneId: string }) =>
        useHossiiConnections({ spaceId: 's1', paneId, enabled: true }),
      { initialProps: { paneId: 'p1' } },
    );

    await waitFor(() => {
      expect(result.current.connections).toHaveLength(1);
    });

    fetchConnectionsMock.mockImplementation(
      () =>
        new Promise(() => {
          /* never resolves */
        }),
    );

    rerender({ paneId: 'p2' });

    expect(result.current.connections).toEqual([]);
  });
});
