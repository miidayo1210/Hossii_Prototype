import { describe, expect, it, vi } from 'vitest';
import {
  createMyAuthorshipIdsController,
  EMPTY_MY_AUTHORSHIP_IDS,
  type MyAuthorshipIdsSnapshot,
} from './myAuthorshipIdsController';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function defer<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** microtask を掃くための待機（.then→.catch の連鎖分も掃くため複数 tick 回す） */
const flush = async () => {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
};

function setup(fetchImpl?: (spaceId: string) => Promise<string[]>) {
  const changes: MyAuthorshipIdsSnapshot[] = [];
  const fetchIds = vi.fn(fetchImpl ?? (async () => []));
  const onError = vi.fn();
  const controller = createMyAuthorshipIdsController({
    fetchIds,
    onChange: (snap) => changes.push(snap),
    onError,
  });
  return { controller, fetchIds, onError, changes };
}

describe('myAuthorshipIdsController', () => {
  it('1. ログイン済み + spaceId → fetch を1回呼ぶ', () => {
    const { controller, fetchIds } = setup();
    controller.sync({ authReady: true, uid: 'u1', spaceId: 's1' });
    expect(fetchIds).toHaveBeenCalledTimes(1);
    expect(fetchIds).toHaveBeenCalledWith('s1');
  });

  it('2. API の配列結果を Set として保持し status=ready', async () => {
    const { controller } = setup(async () => ['a', 'b']);
    controller.sync({ authReady: true, uid: 'u1', spaceId: 's1' });
    await flush();
    const snap = controller.getSnapshot();
    expect(snap.status).toBe('ready');
    expect(snap.ids).toBeInstanceOf(Set);
    expect([...snap.ids].sort()).toEqual(['a', 'b']);
  });

  it('3. 未ログイン → fetch を呼ばず空 Set', () => {
    const { controller, fetchIds } = setup();
    controller.sync({ authReady: true, uid: null, spaceId: 's1' });
    expect(fetchIds).not.toHaveBeenCalled();
    expect(controller.getSnapshot().ids).toBe(EMPTY_MY_AUTHORSHIP_IDS);
    expect(controller.getSnapshot().status).toBe('idle');
  });

  it('4. spaceId なし → fetch を呼ばず空 Set', () => {
    const { controller, fetchIds } = setup();
    controller.sync({ authReady: true, uid: 'u1', spaceId: null });
    expect(fetchIds).not.toHaveBeenCalled();
    expect(controller.getSnapshot().ids).toBe(EMPTY_MY_AUTHORSHIP_IDS);
  });

  it('5. logout（uid→null）→ 即座に空 Set', async () => {
    const { controller } = setup(async () => ['a']);
    controller.sync({ authReady: true, uid: 'u1', spaceId: 's1' });
    await flush();
    expect(controller.getSnapshot().status).toBe('ready');

    controller.sync({ authReady: true, uid: null, spaceId: 's1' });
    expect(controller.getSnapshot().ids).toBe(EMPTY_MY_AUTHORSHIP_IDS);
    expect(controller.getSnapshot().status).toBe('idle');
  });

  it('6. space A→B 切替 → A の Set を即座に消す（fetch 完了前）', async () => {
    const dA = defer<string[]>();
    const dB = defer<string[]>();
    const fetchImpl = vi.fn((spaceId: string) =>
      spaceId === 'A' ? dA.promise : dB.promise,
    );
    const { controller } = setup(fetchImpl);

    controller.sync({ authReady: true, uid: 'u1', spaceId: 'A' });
    dA.resolve(['a1', 'a2']);
    await flush();
    expect([...controller.getSnapshot().ids].sort()).toEqual(['a1', 'a2']);

    // B へ切替：まだ B は resolve していない
    controller.sync({ authReady: true, uid: 'u1', spaceId: 'B' });
    // 切替の瞬間に A の ID が消えている
    expect(controller.getSnapshot().ids).toBe(EMPTY_MY_AUTHORSHIP_IDS);
    expect(controller.getSnapshot().status).toBe('loading');

    dB.resolve(['b1']);
    await flush();
    expect([...controller.getSnapshot().ids]).toEqual(['b1']);
  });

  it('7. A の遅い response が B 切替後に返っても反映されない（race guard）', async () => {
    const dA = defer<string[]>();
    const dB = defer<string[]>();
    const fetchImpl = vi.fn((spaceId: string) =>
      spaceId === 'A' ? dA.promise : dB.promise,
    );
    const { controller } = setup(fetchImpl);

    controller.sync({ authReady: true, uid: 'u1', spaceId: 'A' });
    controller.sync({ authReady: true, uid: 'u1', spaceId: 'B' });

    // B を先に解決
    dB.resolve(['b1']);
    await flush();
    expect([...controller.getSnapshot().ids]).toEqual(['b1']);

    // その後 A の遅い応答が届く → 無視される
    dA.resolve(['a1', 'a2']);
    await flush();
    expect([...controller.getSnapshot().ids]).toEqual(['b1']);
    expect(controller.getSnapshot().status).toBe('ready');
  });

  it('8. user A→user B 変更（同一 space）→ A の Set を消して再 fetch', async () => {
    const { controller, fetchIds } = setup(async (spaceId) => [`${spaceId}-post`]);
    controller.sync({ authReady: true, uid: 'A', spaceId: 's1' });
    await flush();
    expect([...controller.getSnapshot().ids]).toEqual(['s1-post']);

    controller.sync({ authReady: true, uid: 'B', spaceId: 's1' });
    // 切替の瞬間にクリア
    expect(controller.getSnapshot().ids).toBe(EMPTY_MY_AUTHORSHIP_IDS);
    await flush();
    expect(fetchIds).toHaveBeenCalledTimes(2);
    expect([...controller.getSnapshot().ids]).toEqual(['s1-post']);
  });

  it('9. API error → 空 Set・status=error・onError 呼び出し', async () => {
    const { controller, onError } = setup(async () => {
      throw new Error('boom');
    });
    controller.sync({ authReady: true, uid: 'u1', spaceId: 's1' });
    await flush();
    expect(controller.getSnapshot().ids).toBe(EMPTY_MY_AUTHORSHIP_IDS);
    expect(controller.getSnapshot().status).toBe('error');
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('9b. error 後の同一 user・同一 space 再要求では再 fetch しない（無限 retry 防止）', async () => {
    const { controller, fetchIds } = setup(async () => {
      throw new Error('boom');
    });
    controller.sync({ authReady: true, uid: 'u1', spaceId: 's1' });
    await flush();
    expect(controller.getSnapshot().status).toBe('error');

    controller.sync({ authReady: true, uid: 'u1', spaceId: 's1' });
    await flush();
    expect(fetchIds).toHaveBeenCalledTimes(1);
  });

  it('10. 重複 ID 入力 → Set で一意になる', async () => {
    const { controller } = setup(async () => ['x', 'x', 'y']);
    controller.sync({ authReady: true, uid: 'u1', spaceId: 's1' });
    await flush();
    expect([...controller.getSnapshot().ids].sort()).toEqual(['x', 'y']);
    expect(controller.getSnapshot().ids.size).toBe(2);
  });

  it('11. 同一 space・同一 user の再 sync では重複 fetch しない', async () => {
    const { controller, fetchIds } = setup(async () => ['a']);
    controller.sync({ authReady: true, uid: 'u1', spaceId: 's1' });
    await flush();
    controller.sync({ authReady: true, uid: 'u1', spaceId: 's1' });
    controller.sync({ authReady: true, uid: 'u1', spaceId: 's1' });
    await flush();
    expect(fetchIds).toHaveBeenCalledTimes(1);
  });

  it('12. dispose 後は in-flight 応答を state に反映しない', async () => {
    const d = defer<string[]>();
    const { controller, changes } = setup(() => d.promise);
    controller.sync({ authReady: true, uid: 'u1', spaceId: 's1' });
    const changeCountBeforeDispose = changes.length; // loading emit まで

    controller.dispose();
    d.resolve(['a']);
    await flush();

    // dispose 後の onChange は無い
    expect(changes.length).toBe(changeCountBeforeDispose);
    expect(controller.getSnapshot().status).toBe('loading');
    expect(controller.getSnapshot().ids).toBe(EMPTY_MY_AUTHORSHIP_IDS);
  });

  it('12b. dispose 後の sync は何もしない', () => {
    const { controller, fetchIds } = setup();
    controller.dispose();
    controller.sync({ authReady: true, uid: 'u1', spaceId: 's1' });
    expect(fetchIds).not.toHaveBeenCalled();
  });

  it('認証 loading 中（authReady=false）は fetch せず空・安全側', () => {
    const { controller, fetchIds } = setup();
    controller.sync({ authReady: false, uid: 'u1', spaceId: 's1' });
    expect(fetchIds).not.toHaveBeenCalled();
    expect(controller.getSnapshot().ids).toBe(EMPTY_MY_AUTHORSHIP_IDS);
    expect(controller.getSnapshot().status).toBe('idle');
  });

  it('認証 loading 中に入っても、確定後は fetch できる', async () => {
    const { controller, fetchIds } = setup(async () => ['a']);
    controller.sync({ authReady: false, uid: 'u1', spaceId: 's1' });
    controller.sync({ authReady: true, uid: 'u1', spaceId: 's1' });
    await flush();
    expect(fetchIds).toHaveBeenCalledTimes(1);
    expect([...controller.getSnapshot().ids]).toEqual(['a']);
  });

  it('ready 中に authReady=false（再解決開始）→ 既存 ID を残さず空へ', async () => {
    const { controller } = setup(async () => ['a']);
    controller.sync({ authReady: true, uid: 'u1', spaceId: 's1' });
    await flush();
    expect(controller.getSnapshot().status).toBe('ready');

    controller.sync({ authReady: false, uid: 'u1', spaceId: 's1' });
    expect(controller.getSnapshot().ids).toBe(EMPTY_MY_AUTHORSHIP_IDS);
    expect(controller.getSnapshot().status).toBe('idle');
  });

  it('reset() は in-flight を無効化して空へ戻す', async () => {
    const d = defer<string[]>();
    const { controller } = setup(() => d.promise);
    controller.sync({ authReady: true, uid: 'u1', spaceId: 's1' });
    controller.reset();
    d.resolve(['a']);
    await flush();
    expect(controller.getSnapshot().ids).toBe(EMPTY_MY_AUTHORSHIP_IDS);
    expect(controller.getSnapshot().status).toBe('idle');
  });

  it('onChange は snapshot が変化したときだけ呼ばれる', async () => {
    const { controller, changes } = setup(async () => ['a']);
    // 未ログインを2回 → idle/empty のままなので onChange は増えない
    controller.sync({ authReady: true, uid: null, spaceId: 's1' });
    controller.sync({ authReady: true, uid: null, spaceId: 's1' });
    await flush();
    expect(changes.length).toBe(0);
  });
});
