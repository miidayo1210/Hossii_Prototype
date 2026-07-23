// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
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
      expect(result.current.fetchError).toBe(true);
    });
  });

  it('clears fetchError when disabled', async () => {
    fetchConnectionsMock.mockResolvedValue({
      ok: false,
      message: 'network error',
    });

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useHossiiConnections({ spaceId: 's1', paneId: 'p1', enabled }),
      { initialProps: { enabled: true } },
    );

    await waitFor(() => {
      expect(result.current.fetchError).toBe(true);
    });

    rerender({ enabled: false });

    await waitFor(() => {
      expect(result.current.fetchError).toBe(false);
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

  const connectionP1 = {
    id: 'c1',
    spaceId: 's1',
    paneId: 'p1',
    sourceHossiiId: 'a',
    targetHossiiId: 'b',
    strength: 'soft' as const,
    reasonText: null,
    reasonEmoji: null,
    createdBy: null,
    createdAt: 't1',
    updatedAt: 't1',
  };

  const connectionP1b = {
    ...connectionP1,
    id: 'c2',
    targetHossiiId: 'c',
  };

  it('refetch success updates connections', async () => {
    fetchConnectionsMock
      .mockResolvedValueOnce({ ok: true, connections: [connectionP1] })
      .mockResolvedValueOnce({ ok: true, connections: [connectionP1, connectionP1b] });

    const { result } = renderHook(() =>
      useHossiiConnections({ spaceId: 's1', paneId: 'p1', enabled: true }),
    );

    await waitFor(() => {
      expect(result.current.connections).toHaveLength(1);
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.connections).toHaveLength(2);
    });
  });

  it('keeps existing connections when refetch fails', async () => {
    fetchConnectionsMock
      .mockResolvedValueOnce({ ok: true, connections: [connectionP1] })
      .mockResolvedValueOnce({ ok: false, message: 'network error' });

    const { result } = renderHook(() =>
      useHossiiConnections({ spaceId: 's1', paneId: 'p1', enabled: true }),
    );

    await waitFor(() => {
      expect(result.current.connections).toHaveLength(1);
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(fetchConnectionsMock).toHaveBeenCalledTimes(2);
      expect(result.current.fetchError).toBe(true);
    });

    expect(result.current.connections).toEqual([connectionP1]);
  });

  it('clears fetchError after refetch success', async () => {
    fetchConnectionsMock
      .mockResolvedValueOnce({ ok: false, message: 'network error' })
      .mockResolvedValueOnce({ ok: true, connections: [connectionP1] });

    const { result } = renderHook(() =>
      useHossiiConnections({ spaceId: 's1', paneId: 'p1', enabled: true }),
    );

    await waitFor(() => {
      expect(result.current.fetchError).toBe(true);
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.fetchError).toBe(false);
      expect(result.current.connections).toEqual([connectionP1]);
    });
  });

  it('does not spam fetchError when repeated refetch fails', async () => {
    fetchConnectionsMock
      .mockResolvedValueOnce({ ok: true, connections: [connectionP1] })
      .mockResolvedValue({ ok: false, message: 'network error' });

    const { result } = renderHook(() =>
      useHossiiConnections({ spaceId: 's1', paneId: 'p1', enabled: true }),
    );

    await waitFor(() => {
      expect(result.current.connections).toHaveLength(1);
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.fetchError).toBe(true);
    });

    act(() => {
      result.current.refetch();
      result.current.refetch();
    });

    await waitFor(() => {
      expect(fetchConnectionsMock.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    expect(result.current.fetchError).toBe(true);
    expect(result.current.connections).toEqual([connectionP1]);
  });

  it('does not clear connections during refetch before fetch resolves', async () => {
    fetchConnectionsMock.mockResolvedValueOnce({ ok: true, connections: [connectionP1] });

    const { result } = renderHook(() =>
      useHossiiConnections({ spaceId: 's1', paneId: 'p1', enabled: true }),
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

    act(() => {
      result.current.refetch();
    });

    expect(result.current.connections).toEqual([connectionP1]);
  });
});
