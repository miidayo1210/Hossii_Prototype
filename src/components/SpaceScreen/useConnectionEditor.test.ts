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
    reasonText: null,
    reasonEmoji: null,
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
      onUpdateReason: vi.fn(async () => ({
        ok: true as const,
        data: makeConnection({ reasonText: '更新', reasonEmoji: '💡' }),
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
    expect(result.current.reasonExpanded).toBe(false);

    await act(async () => {
      await result.current.submitSave();
    });

    expect(callbacks.onCreate).toHaveBeenCalledWith({
      sourceHossiiId: 'hossii-a',
      targetHossiiId: 'hossii-b',
      strength: 'medium',
    });
    expect(result.current.phase).toBe('idle');
  });

  it('create reasonなしでは reason キーを送らない', async () => {
    const { result } = renderHook(() => useConnectionEditor(callbacks));

    act(() => {
      result.current.startCreate('hossii-a');
      result.current.chooseTarget('hossii-b');
    });

    await act(async () => {
      await result.current.submitSave();
    });

    expect(callbacks.onCreate).toHaveBeenCalledWith({
      sourceHossiiId: 'hossii-a',
      targetHossiiId: 'hossii-b',
      strength: 'medium',
    });
  });

  it('create emoji のみ', async () => {
    const { result } = renderHook(() => useConnectionEditor(callbacks));

    act(() => {
      result.current.startCreate('hossii-a');
      result.current.chooseTarget('hossii-b');
      result.current.toggleReasonExpanded();
      result.current.toggleDraftReasonEmoji('💡');
    });

    await act(async () => {
      await result.current.submitSave();
    });

    expect(callbacks.onCreate).toHaveBeenCalledWith({
      sourceHossiiId: 'hossii-a',
      targetHossiiId: 'hossii-b',
      strength: 'medium',
      reasonEmoji: '💡',
    });
  });

  it('create text のみ', async () => {
    const { result } = renderHook(() => useConnectionEditor(callbacks));

    act(() => {
      result.current.startCreate('hossii-a');
      result.current.chooseTarget('hossii-b');
      result.current.toggleReasonExpanded();
      result.current.setDraftReasonText('つながり');
    });

    await act(async () => {
      await result.current.submitSave();
    });

    expect(callbacks.onCreate).toHaveBeenCalledWith({
      sourceHossiiId: 'hossii-a',
      targetHossiiId: 'hossii-b',
      strength: 'medium',
      reasonText: 'つながり',
    });
  });

  it('create emoji＋text', async () => {
    const { result } = renderHook(() => useConnectionEditor(callbacks));

    act(() => {
      result.current.startCreate('hossii-a');
      result.current.chooseTarget('hossii-b');
      result.current.toggleReasonExpanded();
      result.current.setDraftReasonText('理由');
      result.current.toggleDraftReasonEmoji('🔗');
    });

    await act(async () => {
      await result.current.submitSave();
    });

    expect(callbacks.onCreate).toHaveBeenCalledWith({
      sourceHossiiId: 'hossii-a',
      targetHossiiId: 'hossii-b',
      strength: 'medium',
      reasonText: '理由',
      reasonEmoji: '🔗',
    });
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
      submitPromise = result.current.submitSave();
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
      first = result.current.submitSave();
    });

    let secondValue: boolean | undefined;
    await act(async () => {
      secondValue = await result.current.submitSave();
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
      await result.current.submitSave();
    });

    expect(result.current.phase).toBe('error');
    expect(result.current.errorMessage).toBe('保存に失敗しました');
  });

  it('retries create after API failure and clears error on retry start', async () => {
    callbacks.onCreate = vi
      .fn()
      .mockResolvedValueOnce({ ok: false as const, message: '保存に失敗しました' })
      .mockResolvedValueOnce({ ok: true as const, data: makeConnection() });

    const { result } = renderHook(() => useConnectionEditor(callbacks));

    act(() => {
      result.current.startCreate('hossii-a');
      result.current.chooseTarget('hossii-b');
      result.current.setDraftReasonText('再試行');
    });

    await act(async () => {
      await result.current.submitSave();
    });

    expect(result.current.phase).toBe('error');
    expect(result.current.draftReasonText).toBe('再試行');

    await act(async () => {
      await result.current.submitSave();
    });

    expect(callbacks.onCreate).toHaveBeenCalledTimes(2);
    expect(callbacks.onCreate).toHaveBeenLastCalledWith({
      sourceHossiiId: 'hossii-a',
      targetHossiiId: 'hossii-b',
      strength: 'medium',
      reasonText: '再試行',
    });
    expect(result.current.phase).toBe('idle');
    expect(result.current.errorMessage).toBeNull();
  });

  it('retries edit after API failure', async () => {
    callbacks.onUpdateStrength = vi
      .fn()
      .mockResolvedValueOnce({ ok: false as const, message: '更新に失敗しました' })
      .mockResolvedValueOnce({
        ok: true as const,
        data: makeConnection({ strength: 'strong' }),
      });

    const { result } = renderHook(() => useConnectionEditor(callbacks));
    const connection = makeConnection();

    act(() => {
      result.current.startEdit(connection);
      result.current.chooseStrength('strong');
    });

    await act(async () => {
      await result.current.submitSave();
    });

    expect(result.current.phase).toBe('error');
    expect(result.current.selectedStrength).toBe('strong');

    await act(async () => {
      await result.current.submitSave();
    });

    expect(callbacks.onUpdateStrength).toHaveBeenCalledTimes(2);
    expect(result.current.phase).toBe('idle');
  });

  it('retries reason-only update after API failure', async () => {
    callbacks.onUpdateReason = vi
      .fn()
      .mockResolvedValueOnce({ ok: false as const, message: '理由を保存できませんでした' })
      .mockResolvedValueOnce({
        ok: true as const,
        data: makeConnection({ reasonText: '再試行理由', reasonEmoji: '💡' }),
      });

    const { result } = renderHook(() => useConnectionEditor(callbacks));
    const connection = makeConnection();

    act(() => {
      result.current.startEdit(connection);
      result.current.toggleReasonExpanded();
      result.current.setDraftReasonText('再試行理由');
      result.current.toggleDraftReasonEmoji('💡');
    });

    await act(async () => {
      await result.current.submitSave();
    });

    expect(result.current.phase).toBe('error');
    expect(callbacks.onUpdateStrength).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.submitSave();
    });

    expect(callbacks.onUpdateReason).toHaveBeenCalledTimes(2);
    expect(result.current.phase).toBe('idle');
  });

  it('does not call reason update when strength update fails', async () => {
    callbacks.onUpdateStrength = vi.fn(async () => ({
      ok: false as const,
      message: 'strength failed',
    }));

    const { result } = renderHook(() => useConnectionEditor(callbacks));
    const connection = makeConnection();

    act(() => {
      result.current.startEdit(connection);
      result.current.chooseStrength('strong');
      result.current.toggleReasonExpanded();
      result.current.setDraftReasonText('理由');
    });

    await act(async () => {
      await result.current.submitSave();
    });

    expect(callbacks.onUpdateStrength).toHaveBeenCalledTimes(1);
    expect(callbacks.onUpdateReason).not.toHaveBeenCalled();
    expect(result.current.phase).toBe('error');
    expect(result.current.errorMessage).toBe('strength failed');
  });

  it('prevents double submit while retrying after error', async () => {
    const deferred = createDeferred<ReturnType<typeof makeConnection>>();
    callbacks.onCreate = vi
      .fn()
      .mockResolvedValueOnce({ ok: false as const, message: '保存に失敗しました' })
      .mockImplementationOnce(() => deferred.promise.then((data) => ({ ok: true as const, data })));

    const { result } = renderHook(() => useConnectionEditor(callbacks));

    act(() => {
      result.current.startCreate('hossii-a');
      result.current.chooseTarget('hossii-b');
    });

    await act(async () => {
      await result.current.submitSave();
    });
    expect(result.current.phase).toBe('error');

    let firstRetry!: Promise<boolean>;
    act(() => {
      firstRetry = result.current.submitSave();
    });
    expect(result.current.phase).toBe('saving');

    let secondRetryValue: boolean | undefined;
    await act(async () => {
      secondRetryValue = await result.current.submitSave();
    });

    deferred.resolve(makeConnection());
    await act(async () => {
      await firstRetry;
    });

    expect(callbacks.onCreate).toHaveBeenCalledTimes(2);
    expect(secondRetryValue).toBe(false);
  });

  it('allows cancel after create error', async () => {
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
      await result.current.submitSave();
    });

    act(() => {
      result.current.cancel();
    });

    expect(result.current.phase).toBe('idle');
    expect(result.current.errorMessage).toBeNull();
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
      void result.current.submitSave();
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

  it('seeds existing reason on edit and expands when present', () => {
    const { result } = renderHook(() => useConnectionEditor(callbacks));
    const connection = makeConnection({ reasonText: '既存', reasonEmoji: '💡' });

    act(() => {
      result.current.startEdit(connection);
    });

    expect(result.current.draftReasonText).toBe('既存');
    expect(result.current.draftReasonEmoji).toBe('💡');
    expect(result.current.reasonExpanded).toBe(true);
  });

  it('reason-only更新', async () => {
    const { result } = renderHook(() => useConnectionEditor(callbacks));
    const connection = makeConnection({ reasonText: null, reasonEmoji: null });

    act(() => {
      result.current.startEdit(connection);
      result.current.toggleReasonExpanded();
      result.current.setDraftReasonText('新しい理由');
    });

    await act(async () => {
      await result.current.submitSave();
    });

    expect(callbacks.onUpdateStrength).not.toHaveBeenCalled();
    expect(callbacks.onUpdateReason).toHaveBeenCalledWith({
      connectionId: 'conn-1',
      reasonText: '新しい理由',
    });
  });

  it('strength-only更新', async () => {
    const { result } = renderHook(() => useConnectionEditor(callbacks));
    const connection = makeConnection();

    act(() => {
      result.current.startEdit(connection);
      result.current.chooseStrength('strong');
    });

    await act(async () => {
      await result.current.submitSave();
    });

    expect(callbacks.onUpdateStrength).toHaveBeenCalledWith({
      connectionId: 'conn-1',
      strength: 'strong',
    });
    expect(callbacks.onUpdateReason).not.toHaveBeenCalled();
  });

  it('strength＋reason更新', async () => {
    const { result } = renderHook(() => useConnectionEditor(callbacks));
    const connection = makeConnection();

    act(() => {
      result.current.startEdit(connection);
      result.current.chooseStrength('strong');
      result.current.toggleReasonExpanded();
      result.current.setDraftReasonText('理由');
      result.current.toggleDraftReasonEmoji('❤️');
    });

    await act(async () => {
      await result.current.submitSave();
    });

    expect(callbacks.onUpdateStrength).toHaveBeenCalled();
    expect(callbacks.onUpdateReason).toHaveBeenCalledWith({
      connectionId: 'conn-1',
      reasonText: '理由',
      reasonEmoji: '❤️',
    });
  });

  it('text clear sends null only for text', async () => {
    const { result } = renderHook(() => useConnectionEditor(callbacks));
    const connection = makeConnection({ reasonText: '既存', reasonEmoji: '💡' });

    act(() => {
      result.current.startEdit(connection);
      result.current.setDraftReasonText('');
    });

    await act(async () => {
      await result.current.submitSave();
    });

    expect(callbacks.onUpdateReason).toHaveBeenCalledWith({
      connectionId: 'conn-1',
      reasonText: null,
    });
  });

  it('emoji clear sends null only for emoji', async () => {
    const { result } = renderHook(() => useConnectionEditor(callbacks));
    const connection = makeConnection({ reasonText: '既存', reasonEmoji: '💡' });

    act(() => {
      result.current.startEdit(connection);
      result.current.toggleDraftReasonEmoji('💡');
    });

    await act(async () => {
      await result.current.submitSave();
    });

    expect(callbacks.onUpdateReason).toHaveBeenCalledWith({
      connectionId: 'conn-1',
      reasonEmoji: null,
    });
  });

  it('変更なしでは API を呼ばず idle に戻る', async () => {
    const { result } = renderHook(() => useConnectionEditor(callbacks));
    const connection = makeConnection({ reasonText: '既存', reasonEmoji: '💡' });

    act(() => {
      result.current.startEdit(connection);
    });

    await act(async () => {
      await result.current.submitSave();
    });

    expect(callbacks.onUpdateStrength).not.toHaveBeenCalled();
    expect(callbacks.onUpdateReason).not.toHaveBeenCalled();
    expect(result.current.phase).toBe('idle');
  });

  it('validation失敗で API を呼ばない', async () => {
    const { result } = renderHook(() => useConnectionEditor(callbacks));

    act(() => {
      result.current.startCreate('hossii-a');
      result.current.chooseTarget('hossii-b');
      result.current.toggleReasonExpanded();
      result.current.setDraftReasonText('あ'.repeat(51));
    });

    await act(async () => {
      await result.current.submitSave();
    });

    expect(callbacks.onCreate).not.toHaveBeenCalled();
    expect(result.current.errorMessage).toContain('50文字');
    expect(result.current.phase).toBe('pickingStrength');
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
      await result.current.submitSave();
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
