// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const generateIdMock = vi.hoisted(() =>
  vi.fn(() => `id-${Math.random().toString(36).slice(2, 8)}`),
);

const randomUUIDMock = vi.hoisted(() =>
  vi.fn(() => '11111111-1111-4111-8111-111111111111'),
);

vi.mock('../../core/utils', () => ({
  generateId: generateIdMock,
}));

import { useTypeBEditor, isTypeAEditorBlockingTypeB, isTypeBEditorBlockingTypeA } from './useTypeBEditor';

describe('useTypeBEditor', () => {
  beforeEach(() => {
    generateIdMock.mockReset();
    randomUUIDMock.mockReset();
    vi.stubGlobal('crypto', {
      ...globalThis.crypto,
      randomUUID: randomUUIDMock,
    });
    randomUUIDMock
      .mockReturnValueOnce('11111111-1111-4111-8111-111111111111')
      .mockReturnValueOnce('22222222-2222-4222-8222-222222222222');
    generateIdMock.mockReturnValueOnce('new-1').mockReturnValueOnce('new-2');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts composing with UUID idempotency key and generateId new hossii id', () => {
    const { result } = renderHook(() => useTypeBEditor());

    act(() => {
      result.current.startCreate({
        originHossiiId: 'origin-1',
        positionX: 42,
        positionY: 55,
      });
    });

    expect(result.current.phase).toBe('composing');
    expect(result.current.originHossiiId).toBe('origin-1');
    expect(result.current.positionX).toBe(42);
    expect(result.current.positionY).toBe(55);
    expect(result.current.idempotencyKey).toBe('11111111-1111-4111-8111-111111111111');
    expect(result.current.idempotencyKey).toMatch(UUID_V4_PATTERN);
    expect(result.current.newHossiiId).toBe('new-1');
    expect(result.current.idempotencyKey).not.toBe(result.current.newHossiiId);
    expect(randomUUIDMock).toHaveBeenCalledTimes(1);
    expect(generateIdMock).toHaveBeenCalledTimes(1);
    expect(result.current.showProvisionalThread).toBe(true);
    expect(result.current.isBubbleSwitchBlocked).toBe(true);
  });

  it('keeps draft and error on submit failure', () => {
    const { result } = renderHook(() => useTypeBEditor());

    act(() => {
      result.current.startCreate({
        originHossiiId: 'origin-1',
        positionX: 10,
        positionY: 20,
      });
      result.current.setDraftMessage('draft text');
    });

    act(() => {
      result.current.beginSubmit();
      result.current.submitFailure('boom');
    });

    expect(result.current.phase).toBe('error');
    expect(result.current.draftMessage).toBe('draft text');
    expect(result.current.errorMessage).toBe('boom');
    expect(result.current.showProvisionalThread).toBe(false);
  });

  it('reuses same ids on retry after error', () => {
    const { result } = renderHook(() => useTypeBEditor());

    act(() => {
      result.current.startCreate({
        originHossiiId: 'origin-1',
        positionX: 10,
        positionY: 20,
      });
    });

    const { idempotencyKey, newHossiiId } = result.current;

    act(() => {
      result.current.beginSubmit();
      result.current.submitFailure('fail');
      result.current.beginSubmit();
    });

    expect(result.current.idempotencyKey).toBe(idempotencyKey);
    expect(result.current.newHossiiId).toBe(newHossiiId);
    expect(result.current.phase).toBe('submitting');
    expect(randomUUIDMock).toHaveBeenCalledTimes(1);
  });

  it('issues a new UUID after cancel and recompose', () => {
    const { result } = renderHook(() => useTypeBEditor());

    act(() => {
      result.current.startCreate({
        originHossiiId: 'origin-1',
        positionX: 10,
        positionY: 20,
      });
    });

    expect(result.current.idempotencyKey).toBe('11111111-1111-4111-8111-111111111111');

    act(() => {
      result.current.cancel();
    });

    act(() => {
      result.current.startCreate({
        originHossiiId: 'origin-1',
        positionX: 12,
        positionY: 24,
      });
    });

    expect(result.current.idempotencyKey).toBe('22222222-2222-4222-8222-222222222222');
    expect(randomUUIDMock).toHaveBeenCalledTimes(2);
  });

  it('prevents double submit while submitting', () => {
    const { result } = renderHook(() => useTypeBEditor());

    act(() => {
      result.current.startCreate({
        originHossiiId: 'origin-1',
        positionX: 10,
        positionY: 20,
      });
    });

    let first = false;
    let second = false;
    act(() => {
      first = result.current.beginSubmit();
      second = result.current.beginSubmit();
    });

    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it('clears all state on cancel', () => {
    const { result } = renderHook(() => useTypeBEditor());

    act(() => {
      result.current.startCreate({
        originHossiiId: 'origin-1',
        positionX: 10,
        positionY: 20,
      });
      result.current.setDraftMessage('draft');
      result.current.cancel();
    });

    expect(result.current.phase).toBe('idle');
    expect(result.current.originHossiiId).toBeNull();
    expect(result.current.draftMessage).toBe('');
  });

  it('ignores cancel while submitting', () => {
    const { result } = renderHook(() => useTypeBEditor());

    act(() => {
      result.current.startCreate({
        originHossiiId: 'origin-1',
        positionX: 10,
        positionY: 20,
      });
    });

    act(() => {
      result.current.beginSubmit();
    });

    act(() => {
      result.current.cancel();
    });

    expect(result.current.phase).toBe('submitting');
    expect(result.current.originHossiiId).toBe('origin-1');
  });

  it('blocks bubble switch during error', () => {
    const { result } = renderHook(() => useTypeBEditor());

    act(() => {
      result.current.startCreate({
        originHossiiId: 'origin-1',
        positionX: 10,
        positionY: 20,
      });
      result.current.beginSubmit();
      result.current.submitFailure('fail');
    });

    expect(result.current.isBubbleSwitchBlocked).toBe(true);
  });

  it('resets to idle on success', () => {
    const { result } = renderHook(() => useTypeBEditor());

    act(() => {
      result.current.startCreate({
        originHossiiId: 'origin-1',
        positionX: 10,
        positionY: 20,
      });
      result.current.beginSubmit();
      result.current.submitSuccess();
    });

    expect(result.current.phase).toBe('idle');
    expect(result.current.isActive).toBe(false);
  });
});

describe('type editor mutual exclusion helpers', () => {
  it('blocks Type B when Type A is active', () => {
    expect(isTypeAEditorBlockingTypeB('pickingTarget')).toBe(true);
    expect(isTypeAEditorBlockingTypeB('idle')).toBe(false);
    expect(isTypeAEditorBlockingTypeB('error')).toBe(false);
  });

  it('blocks Type A when Type B is active', () => {
    expect(isTypeBEditorBlockingTypeA('composing')).toBe(true);
    expect(isTypeBEditorBlockingTypeA('submitting')).toBe(true);
    expect(isTypeBEditorBlockingTypeA('error')).toBe(true);
    expect(isTypeBEditorBlockingTypeA('idle')).toBe(false);
  });
});
