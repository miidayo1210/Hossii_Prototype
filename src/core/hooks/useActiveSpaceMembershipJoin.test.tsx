// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import type { Space } from '../types/space';
import { useActiveSpaceMembershipJoin } from './useActiveSpaceMembershipJoin';

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

function makeSpace(over: Partial<Space> & Pick<Space, 'id'>): Space {
  return {
    name: over.name ?? 'Test Space',
    quickEmotions: [],
    createdAt: new Date('2026-01-01'),
    accessMode: 'public',
    spaceType: 'shared',
    ...over,
  };
}

const resolveNickname = () => 'にっく';

const defaultSpaces = [
  makeSpace({ id: 'space-shared', spaceType: 'shared', accessMode: 'public' }),
  makeSpace({ id: 'space-personal', spaceType: 'personal', accessMode: 'public' }),
];

function makeParams(
  join: ReturnType<typeof vi.fn>,
  over: Partial<Parameters<typeof useActiveSpaceMembershipJoin>[0]> = {},
) {
  return {
    configured: true,
    authReady: true,
    uid: 'user-1',
    activeSpaceId: 'space-shared',
    spaces: defaultSpaces,
    isGuest: false,
    resolveNickname,
    join,
    ...over,
  };
}

function renderMembershipJoin(
  join: ReturnType<typeof vi.fn>,
  over: Partial<Parameters<typeof useActiveSpaceMembershipJoin>[0]> = {},
) {
  const params = makeParams(join, over);
  return renderHook(() => useActiveSpaceMembershipJoin(params));
}

describe('useActiveSpaceMembershipJoin', () => {
  afterEach(() => {
    cleanup();
  });

  it('personal space では Provider 経由で join RPC を呼ばない', async () => {
    const join = vi.fn(async () => ({ id: 'm1' }));
    const { result } = renderMembershipJoin(join, {
      activeSpaceId: 'space-personal',
    });

    await act(async () => {
      await flush();
    });

    expect(join).not.toHaveBeenCalled();
    expect(result.current.activeSpaceMembershipStatus).toBe('none');
  });

  it('error 以外で retry しても RPC を呼ばない', async () => {
    const join = vi.fn(async () => ({ id: 'm1' }));
    const { result } = renderMembershipJoin(join);

    await act(async () => {
      await flush();
    });
    expect(result.current.activeSpaceMembershipStatus).toBe('active');
    expect(join).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.retryActiveSpaceMembershipJoin();
    });
    await act(async () => {
      await flush();
    });

    expect(join).toHaveBeenCalledTimes(1);
  });

  it('error 時 retry は 1 回だけ実行し、成功後 active になる', async () => {
    let calls = 0;
    const join = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error('boom');
      return { id: 'm1' };
    });
    const { result } = renderMembershipJoin(join);

    await act(async () => {
      await flush();
    });
    expect(result.current.activeSpaceMembershipStatus).toBe('error');
    expect(join).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.retryActiveSpaceMembershipJoin();
    });
    await act(async () => {
      await flush();
    });

    expect(join).toHaveBeenCalledTimes(2);
    expect(result.current.activeSpaceMembershipStatus).toBe('active');
  });

  it('retry 連打でも in-flight は 1 本', async () => {
    let resolveJoin: (v: unknown) => void = () => {};
    let calls = 0;
    const join = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error('boom');
      return new Promise((res) => {
        resolveJoin = res;
      });
    });
    const { result } = renderMembershipJoin(join);

    await act(async () => {
      await flush();
    });
    expect(result.current.activeSpaceMembershipStatus).toBe('error');

    act(() => {
      result.current.retryActiveSpaceMembershipJoin();
      result.current.retryActiveSpaceMembershipJoin();
      result.current.retryActiveSpaceMembershipJoin();
    });

    expect(join).toHaveBeenCalledTimes(2);
    expect(result.current.activeSpaceMembershipStatus).toBe('joining');

    await act(async () => {
      resolveJoin({ id: 'm1' });
      await flush();
    });

    expect(join).toHaveBeenCalledTimes(2);
    expect(result.current.activeSpaceMembershipStatus).toBe('active');
  });
});
