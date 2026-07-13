import { describe, it, expect, vi } from 'vitest';
import {
  createMembershipJoinController,
  resolveMembershipNickname,
  type MembershipJoinInput,
} from './membershipJoinController';

// resolve/flush microtasks
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

function makeController(joinImpl?: (spaceId: string, nickname: string | null) => Promise<unknown>) {
  const join = vi.fn(joinImpl ?? (async () => ({ id: 'm1' })));
  const onError = vi.fn();
  const controller = createMembershipJoinController({ join, onError });
  return { controller, join, onError };
}

function input(over: Partial<MembershipJoinInput> = {}): MembershipJoinInput {
  return {
    configured: true,
    authReady: true,
    uid: 'user-1',
    spaceId: 'space-1',
    isGuest: false,
    resolveNickname: () => 'にっく',
    ...over,
  };
}

describe('createMembershipJoinController', () => {
  it('#1 ログイン済み＋activeSpace で join を 1 回、role を渡さず (spaceId, nickname) で呼ぶ', async () => {
    const { controller, join } = makeController();
    controller.sync(input());
    await flush();
    expect(join).toHaveBeenCalledTimes(1);
    expect(join).toHaveBeenCalledWith('space-1', 'にっく');
    // #12: 引数は (spaceId, nickname) の 2 つのみ（role なし）
    expect(join.mock.calls[0]).toHaveLength(2);
  });

  it('#2 guest では呼ばない', () => {
    const { controller, join } = makeController();
    controller.sync(input({ isGuest: true }));
    expect(join).not.toHaveBeenCalled();
  });

  it('#3 session（uid）なしでは呼ばない', () => {
    const { controller, join } = makeController();
    controller.sync(input({ uid: null }));
    expect(join).not.toHaveBeenCalled();
  });

  it('#4 Supabase 未設定では呼ばない', () => {
    const { controller, join } = makeController();
    controller.sync(input({ configured: false }));
    expect(join).not.toHaveBeenCalled();
  });

  it('authReady=false（auth 解決中）では呼ばない', () => {
    const { controller, join } = makeController();
    controller.sync(input({ authReady: false }));
    expect(join).not.toHaveBeenCalled();
  });

  it('activeSpace なしでは呼ばない', () => {
    const { controller, join } = makeController();
    controller.sync(input({ spaceId: null }));
    expect(join).not.toHaveBeenCalled();
  });

  it('#5 同一 uid+spaceId の連続 sync では 1 回だけ join する', async () => {
    const { controller, join } = makeController();
    controller.sync(input());
    await flush();
    controller.sync(input());
    controller.sync(input());
    await flush();
    expect(join).toHaveBeenCalledTimes(1);
  });

  it('#6 space 切替で新 space へ join する', async () => {
    const { controller, join } = makeController();
    controller.sync(input({ spaceId: 'space-1' }));
    await flush();
    controller.sync(input({ spaceId: 'space-2' }));
    await flush();
    expect(join).toHaveBeenCalledTimes(2);
    expect(join).toHaveBeenNthCalledWith(2, 'space-2', 'にっく');
  });

  it('#7 user 切替で再 join する', async () => {
    const { controller, join } = makeController();
    controller.sync(input({ uid: 'user-1' }));
    await flush();
    controller.sync(input({ uid: 'user-2' }));
    await flush();
    expect(join).toHaveBeenCalledTimes(2);
  });

  it('#8 logout（uid=null）→ 再 login で再 join できる', async () => {
    const { controller, join } = makeController();
    controller.sync(input());
    await flush();
    controller.sync(input({ uid: null })); // logout: dedupe 解除
    controller.sync(input()); // 同一 uid+space で再 login
    await flush();
    expect(join).toHaveBeenCalledTimes(2);
  });

  it('#9 join 失敗後は同一 key でも再試行できる（成功を記録しない）', async () => {
    let calls = 0;
    const { controller, join, onError } = makeController(async () => {
      calls += 1;
      if (calls === 1) throw new Error('boom');
      return { id: 'm1' };
    });
    controller.sync(input());
    await flush();
    expect(join).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    // 再 sync で再試行
    controller.sync(input());
    await flush();
    expect(join).toHaveBeenCalledTimes(2);
  });

  it('#10 StrictMode setup→cleanup→setup（同一 key の二重 sync）でも連打しない', async () => {
    // join を遅延させ in-flight 中に 2 回目 setup を模す
    let resolveJoin: (v: unknown) => void = () => {};
    const { controller, join } = makeController(
      () => new Promise((res) => { resolveJoin = res; }),
    );
    controller.sync(input()); // setup #1 -> in-flight
    controller.sync(input()); // setup #2（cleanup 後の再 setup 相当）-> in-flight dedupe
    expect(join).toHaveBeenCalledTimes(1);
    resolveJoin({ id: 'm1' });
    await flush();
    controller.sync(input()); // 成功後の再 sync -> lastSuccessKey で dedupe
    await flush();
    expect(join).toHaveBeenCalledTimes(1);
  });

  it('#11 join が reject しても sync は throw せず、onError に記録する', async () => {
    const { controller, onError } = makeController(async () => { throw new Error('x'); });
    expect(() => controller.sync(input())).not.toThrow();
    await flush();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('resolveNickname が throw しても join は nickname=null で継続する', async () => {
    const { controller, join } = makeController();
    controller.sync(input({ resolveNickname: () => { throw new Error('nick'); } }));
    await flush();
    expect(join).toHaveBeenCalledWith('space-1', null);
  });
});

describe('resolveMembershipNickname', () => {
  const base = {
    spaceNicknames: {} as Record<string, string | undefined>,
    profileDefaultNickname: null as string | null | undefined,
    username: null as string | null | undefined,
    displayName: null as string | null | undefined,
  };

  it('space 固有 nickname を最優先', () => {
    expect(resolveMembershipNickname({ ...base, spaceNicknames: { s1: 'スペース名' }, profileDefaultNickname: 'プロフ' }, 's1')).toBe('スペース名');
  });
  it('space 固有が無ければ profile 表示名', () => {
    expect(resolveMembershipNickname({ ...base, profileDefaultNickname: 'プロフ', username: 'uname' }, 's1')).toBe('プロフ');
  });
  it('profile も無ければ username → displayName の順', () => {
    expect(resolveMembershipNickname({ ...base, username: 'uname', displayName: 'disp' }, 's1')).toBe('uname');
    expect(resolveMembershipNickname({ ...base, displayName: 'disp' }, 's1')).toBe('disp');
  });
  it('どれも無ければ null（空白のみも null）', () => {
    expect(resolveMembershipNickname(base, 's1')).toBeNull();
    expect(resolveMembershipNickname({ ...base, profileDefaultNickname: '   ' }, 's1')).toBeNull();
  });
});
