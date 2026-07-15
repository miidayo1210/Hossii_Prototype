import { describe, expect, it, vi } from 'vitest';
import { createAuthorshipControllerHost } from './authorshipControllerHost';
import {
  createMyAuthorshipIdsController,
  EMPTY_MY_AUTHORSHIP_IDS,
  type MyAuthorshipIdsController,
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

const flush = async () => {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
};

/**
 * Provider と同じ factory 経由で controller を生成するホストを組む。
 * 生成された instance を追跡して A/B の同一性を検証できるようにする。
 */
function makeHost(fetchImpl?: (spaceId: string) => Promise<string[]>) {
  const created: MyAuthorshipIdsController[] = [];
  const fetchIds = vi.fn(fetchImpl ?? (async () => []));
  const host = createAuthorshipControllerHost(() => {
    const controller = createMyAuthorshipIdsController({
      fetchIds,
      onChange: () => {},
      onError: () => {},
    });
    created.push(controller);
    return controller;
  });
  return { host, created, fetchIds };
}

/**
 * HossiiStoreProvider の effect 宣言順（sync effect が lifecycle effect より前）に忠実な
 * StrictMode 相当の実行順を再現するユーティリティ。
 * setup1 → cleanup → setup2 の順で以下を実行する:
 *  - sync effect setup:     host.getOrCreate().sync(syncInput)
 *  - lifecycle effect setup: controller = host.getOrCreate()（cleanup で disposeIfCurrent）
 */
function runStrictModeMount(
  host: ReturnType<typeof makeHost>['host'],
  syncInput: Parameters<MyAuthorshipIdsController['sync']>[0],
) {
  // ---- setup pass 1 ----
  host.getOrCreate().sync(syncInput); // sync effect setup
  const lifecycleController1 = host.getOrCreate(); // lifecycle effect setup
  // ---- simulated unmount (cleanup, reverse order) ----
  host.disposeIfCurrent(lifecycleController1); // lifecycle cleanup
  // ---- setup pass 2 ----
  host.getOrCreate().sync(syncInput); // sync effect setup (re-run)
  host.getOrCreate(); // lifecycle effect setup (re-run)
}

describe('authorshipControllerHost', () => {
  it('getOrCreate は初回に factory で生成し、以後は同一 instance を返す', () => {
    const { host, created } = makeHost();
    const a = host.getOrCreate();
    const again = host.getOrCreate();
    expect(a).toBe(again);
    expect(created.length).toBe(1);
    expect(host.peek()).toBe(a);
  });

  it('peek は生成せず、未生成なら null を返す', () => {
    const { host, created } = makeHost();
    expect(host.peek()).toBeNull();
    expect(created.length).toBe(0);
  });

  it('disposeIfCurrent は現在値のときだけクリアし、別 instance には触れない', () => {
    const { host } = makeHost();
    const a = host.getOrCreate();
    host.disposeIfCurrent(a);
    expect(host.peek()).toBeNull();

    const b = host.getOrCreate();
    // すでに現在値でない A を再 dispose しても B は保持されたまま
    host.disposeIfCurrent(a);
    expect(host.peek()).toBe(b);
  });

  describe('StrictMode setup→cleanup→setup', () => {
    it('#1/#3/#4 A は破棄され別 instance B が生成、B は sync→loading→ready へ遷移', async () => {
      const dA = defer<string[]>();
      const dB = defer<string[]>();
      let call = 0;
      const { host, created } = makeHost(() => {
        call += 1;
        return call === 1 ? dA.promise : dB.promise;
      });

      runStrictModeMount(host, { authReady: true, uid: 'u1', spaceId: 's1' });

      // #1: B は A と別 instance で、現在値は B
      expect(created.length).toBe(2);
      const [a, b] = created;
      expect(b).not.toBe(a);
      expect(host.peek()).toBe(b);

      // #3: B は fetch を開始して loading
      expect(b.getSnapshot().status).toBe('loading');

      // #4: B の応答で ready へ
      dB.resolve(['x']);
      await flush();
      expect(b.getSnapshot().status).toBe('ready');
      expect([...b.getSnapshot().ids]).toEqual(['x']);
    });

    it('#2/#5 dispose 済み A の遅延応答は A に反映されず、B の状態も上書きしない', async () => {
      const dA = defer<string[]>();
      const dB = defer<string[]>();
      let call = 0;
      const { host, created } = makeHost(() => {
        call += 1;
        return call === 1 ? dA.promise : dB.promise;
      });

      runStrictModeMount(host, { authReady: true, uid: 'u1', spaceId: 's1' });
      const [a, b] = created;

      // B を先に ready にする
      dB.resolve(['b1']);
      await flush();
      expect([...b.getSnapshot().ids]).toEqual(['b1']);

      // #5: cleanup 後に届いた A（初回 setup）の応答は B を上書きしない
      // #2: dispose 済み A は自身の状態にも反映しない（loading のまま）
      dA.resolve(['a1', 'a2']);
      await flush();
      expect([...b.getSnapshot().ids]).toEqual(['b1']);
      expect(b.getSnapshot().status).toBe('ready');
      expect(a.getSnapshot().status).toBe('loading');
      expect(a.getSnapshot().ids).toBe(EMPTY_MY_AUTHORSHIP_IDS);
    });

    it('#6 refresh は現在値 B に対して正常動作する（peek 経由）', async () => {
      let ids = ['old-1'];
      const { host, created, fetchIds } = makeHost(async () => [...ids]);

      runStrictModeMount(host, { authReady: true, uid: 'u1', spaceId: 's1' });
      await flush();
      const b = created[1];
      expect(host.peek()).toBe(b);
      expect([...b.getSnapshot().ids]).toEqual(['old-1']);

      const fetchCountBefore = fetchIds.mock.calls.length;
      // 投稿成功後の refresh 相当（Provider は host.peek()?.refresh を呼ぶ）
      ids = ['old-1', 'new-id'];
      host.peek()?.refresh({ uid: 'u1', spaceId: 's1' });
      await flush();

      expect(fetchIds.mock.calls.length).toBe(fetchCountBefore + 1);
      expect(b.getSnapshot().status).toBe('ready');
      expect([...b.getSnapshot().ids].sort()).toEqual(['new-id', 'old-1']);
    });
  });

  describe('genuine unmount', () => {
    it('#7 unmount 後は peek=null で、refresh(peek 経由)から新 controller を再生成しない', async () => {
      const { host, created, fetchIds } = makeHost(async () => ['x']);

      // 通常の mount（StrictMode なし相当）: sync setup → lifecycle setup
      host.getOrCreate().sync({ authReady: true, uid: 'u1', spaceId: 's1' });
      const controller = host.getOrCreate();
      await flush();
      expect(host.peek()).toBe(controller);
      const createdBefore = created.length;
      const fetchBefore = fetchIds.mock.calls.length;

      // genuine unmount: cleanup のみ（再 setup なし）
      host.disposeIfCurrent(controller);
      expect(host.peek()).toBeNull();

      // unmount 後の非同期処理（投稿後 refresh）が届いても、peek は生成しないため no-op
      host.peek()?.refresh({ uid: 'u1', spaceId: 's1' });
      await flush();

      expect(created.length).toBe(createdBefore); // 再生成なし
      expect(fetchIds.mock.calls.length).toBe(fetchBefore); // 追加 fetch なし
    });

    it('unmount 後の in-flight 応答は反映されない', async () => {
      const d = defer<string[]>();
      const { host, created } = makeHost(() => d.promise);
      host.getOrCreate().sync({ authReady: true, uid: 'u1', spaceId: 's1' });
      const controller = host.getOrCreate();
      expect(controller.getSnapshot().status).toBe('loading');

      host.disposeIfCurrent(controller); // genuine unmount
      d.resolve(['x']);
      await flush();

      // dispose 済みなので loading のまま・空
      expect(controller.getSnapshot().status).toBe('loading');
      expect(controller.getSnapshot().ids).toBe(EMPTY_MY_AUTHORSHIP_IDS);
      expect(created.length).toBe(1);
    });
  });
});
