// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { HossiiConnection } from '../../core/types/hossiiConnection';
import { useConnectionEditor } from './useConnectionEditor';
import {
  CONNECTION_SELF_TARGET_ERROR,
  type ConnectionEditorCallbacks,
} from './connectionEditorTypes';

function makeConnection(
  overrides: Partial<HossiiConnection> = {},
): HossiiConnection {
  return {
    id: 'conn-1',
    spaceId: 'space-1',
    paneId: 'pane-1',
    sourceHossiiId: 'hossii-a',
    targetHossiiId: 'hossii-b',
    strength: 'medium',
    createdBy: 'user-1',
    createdAt: '2026-07-22T00:00:00.000Z',
    updatedAt: '2026-07-22T00:00:00.000Z',
    ...overrides,
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('useConnectionEditor', () => {
  let callbacks: ConnectionEditorCallbacks;

  beforeEach(() => {
    callbacks = {
      onCreate: vi.fn(async () => ({
        ok: true as const,
        data: makeConnection(),
      })),
      onUpdateStrength: vi.fn(async () => ({
        ok: true as const,
        data: makeConnection({ strength: 'strong' }),
      })),
      onDelete: vi.fn(async () => ({
        ok: true as const,
        data: { id: 'conn-1' },
      })),
    };
  });

  it('runs create flow and returns to idle after success', async () => {
    const { result } = renderHook(() => useConnectionEditor(callbacks));

    act(() => {
      result.current.startCreate('hossii-a');
    });
    expect(result.current.phase).toBe('pickingTarget');

    act(() => {
      result.current.chooseTarget('hossii-b');
    });
    expect(result.current.phase).toBe('pickingStrength');
    expect(result.current.selectedStrength).toBe('medium');

    await act(async () => {
      await result.current.submitCreate();
    });

    expect(callbacks.onCreate).toHaveBeenCalledWith({
      sourceHossiiId: 'hossii-a',
      targetHossiiId: 'hossii-b',
      strength: 'medium',
    });
    expect(result.current.phase).toBe('idle');
  });

  it('rejects self target', () => {
    const { result } = renderHook(() => useConnectionEditor(callbacks));

    act(() => {
      result.current.startCreate('hossii-a');
      result.current.chooseTarget('hossii-a');
    });

    expect(result.current.phase).toBe('pickingTarget');
    expect(result.current.errorMessage).toBe(CONNECTION_SELF_TARGET_ERROR);
    expect(callbacks.onCreate).not.toHaveBeenCalled();
  });

  it('does not resolve to idle before create callback succeeds', async () => {
    const deferred = createDeferred<ReturnType<typeof makeConnection>>();
    callbacks.onCreate = vi.fn(() => deferred.promise.then((data) => ({ ok: true as const, data })));

    const { result } = renderHook(() => useConnectionEditor(callbacks));

    act(() => {
      result.current.startCreate('hossii-a');
      result.current.chooseTarget('hossii-b');
    });

    let submitPromise!: Promise<boolean>;
    act(() => {
      submitPromise = result.current.submitCreate();
    });

    expect(result.current.phase).toBe('saving');
    expect(result.current.canCancel).toBe(false);

    deferred.resolve(makeConnection());
    await act(async () => {
      await submitPromise;
    });

    expect(result.current.phase).toBe('idle');
  });

  it('prevents double submit while saving', async () => {
    const deferred = createDeferred<ReturnType<typeof makeConnection>>();
    callbacks.onCreate = vi.fn(() => deferred.promise.then((data) => ({ ok: true as const, data })));

    const { result } = renderHook(() => useConnectionEditor(callbacks));

    act(() => {
      result.current.startCreate('hossii-a');
      result.current.chooseTarget('hossii-b');
    });

    let first!: Promise<boolean>;
    act(() => {
      first = result.current.submitCreate();
    });

    let secondValue: boolean | undefined;
    await act(async () => {
      secondValue = await result.current.submitCreate();
    });

    deferred.resolve(makeConnection());
    await act(async () => {
      await first;
    });

    expect(callbacks.onCreate).toHaveBeenCalledTimes(1);
    expect(secondValue).toBe(false);
  });

  it('shows error and blocks cancel while saving', async () => {
    callbacks.onCreate = vi.fn(async () => ({
      ok: false as const,
      message: '保存に失敗しました',
    }));

    const { result } = renderHook(() => useConnectionEditor(callbacks));

    act(() => {
      result.current.startCreate('hossii-a');
      result.current.chooseTarget('hossii-b');
    });

    await act(async () => {
      await result.current.submitCreate();
    });

    expect(result.current.phase).toBe('error');
    expect(result.current.errorMessage).toBe('保存に失敗しました');
  });

  it('blocks cancel and reset while saving', async () => {
    const deferred = createDeferred<ReturnType<typeof makeConnection>>();
    callbacks.onCreate = vi.fn(() => deferred.promise.then((data) => ({ ok: true as const, data })));

    const { result } = renderHook(() => useConnectionEditor(callbacks));

    act(() => {
      result.current.startCreate('hossii-a');
      result.current.chooseTarget('hossii-b');
    });

    act(() => {
      void result.current.submitCreate();
    });

    act(() => {
      result.current.cancel();
      result.current.reset();
    });

    expect(result.current.phase).toBe('saving');

    deferred.resolve(makeConnection());
    await waitFor(() => {
      expect(result.current.phase).toBe('idle');
    });
  });

  it('supports edit, delete confirm, and external reset', async () => {
    const { result } = renderHook(() => useConnectionEditor(callbacks));
    const connection = makeConnection();

    act(() => {
      result.current.startEdit(connection);
      result.current.chooseStrength('strong');
    });
    expect(result.current.phase).toBe('editing');

    await act(async () => {
      await result.current.submitStrengthUpdate();
    });
    expect(callbacks.onUpdateStrength).toHaveBeenCalledWith({
      connectionId: 'conn-1',
      strength: 'strong',
    });

    act(() => {
      result.current.startEdit(connection);
      result.current.requestDelete();
    });
    expect(result.current.phase).toBe('deleting');

    act(() => {
      result.current.cancel();
    });
    expect(result.current.phase).toBe('editing');

    act(() => {
      result.current.requestDelete();
    });

    await act(async () => {
      await result.current.confirmDelete();
    });
    expect(callbacks.onDelete).toHaveBeenCalledWith({ connectionId: 'conn-1' });
    expect(result.current.phase).toBe('idle');

    act(() => {
      result.current.startCreate('hossii-a');
    });
    act(() => {
      result.current.reset();
    });
    expect(result.current.phase).toBe('idle');
  });
});
