import { describe, it, expect, vi } from 'vitest';
import {
  createPostAuthorNamesController,
  EMPTY_POST_AUTHOR_NAMES,
  type PostAuthorNamesSnapshot,
} from './postAuthorNamesController';

/** 解決を外部から制御できる deferred fetch を作る */
function deferredFetch() {
  const resolvers: Array<{
    spaceId: string;
    resolve: (m: Map<string, string>) => void;
    reject: (e: unknown) => void;
  }> = [];
  const fetchNames = vi.fn((spaceId: string) =>
    new Promise<Map<string, string>>((resolve, reject) => {
      resolvers.push({ spaceId, resolve, reject });
    }),
  );
  return { fetchNames, resolvers };
}

function setup(fetchNames: (s: string) => Promise<Map<string, string>>) {
  const snapshots: PostAuthorNamesSnapshot[] = [];
  const onError = vi.fn();
  const controller = createPostAuthorNamesController({
    fetchNames,
    onChange: (s) => snapshots.push(s),
    onError,
  });
  return { controller, snapshots, onError };
}

describe('createPostAuthorNamesController', () => {
  it('sync: ready かつ spaceId あり → loading → ready（取得マップを emit）', async () => {
    const { fetchNames, resolvers } = deferredFetch();
    const { controller, snapshots } = setup(fetchNames);

    controller.sync({ ready: true, spaceId: 'space-1' });
    expect(fetchNames).toHaveBeenCalledWith('space-1');
    expect(snapshots.at(-1)?.status).toBe('loading');
    expect(snapshots.at(-1)?.names.size).toBe(0);

    resolvers[0]!.resolve(new Map([['h1', 'ほっしー太郎']]));
    await Promise.resolve();
    expect(snapshots.at(-1)?.status).toBe('ready');
    expect(snapshots.at(-1)?.names.get('h1')).toBe('ほっしー太郎');
  });

  it('sync: ready=false → idle（fetch しない・初期 idle のまま余計な emit なし）', () => {
    const { fetchNames } = deferredFetch();
    const { controller, snapshots } = setup(fetchNames);
    controller.sync({ ready: false, spaceId: 'space-1' });
    expect(fetchNames).not.toHaveBeenCalled();
    expect(controller.getSnapshot().status).toBe('idle');
    expect(snapshots).toHaveLength(0);
  });

  it('sync: spaceId なし → idle（fetch しない）', () => {
    const { fetchNames } = deferredFetch();
    const { controller } = setup(fetchNames);
    controller.sync({ ready: true, spaceId: null });
    expect(fetchNames).not.toHaveBeenCalled();
    expect(controller.getSnapshot().status).toBe('idle');
  });

  it('#8 space 切替時に旧 space のマップを即クリアしてから取得', async () => {
    const { fetchNames, resolvers } = deferredFetch();
    const { controller, snapshots } = setup(fetchNames);

    controller.sync({ ready: true, spaceId: 'space-1' });
    resolvers[0]!.resolve(new Map([['h1', 'A']]));
    await Promise.resolve();
    expect(snapshots.at(-1)?.names.get('h1')).toBe('A');

    // space 切替 → 取得開始時点で即 EMPTY + loading（旧 space の値を残さない）
    controller.sync({ ready: true, spaceId: 'space-2' });
    const afterSwitch = snapshots.at(-1)!;
    expect(afterSwitch.status).toBe('loading');
    expect(afterSwitch.names).toBe(EMPTY_POST_AUTHOR_NAMES);
    expect(afterSwitch.names.has('h1')).toBe(false);

    resolvers[1]!.resolve(new Map([['h2', 'B']]));
    await Promise.resolve();
    expect(snapshots.at(-1)?.names.get('h2')).toBe('B');
    expect(snapshots.at(-1)?.names.has('h1')).toBe(false);
  });

  it('#9 古い（superseded）応答は seq guard で破棄する', async () => {
    const { fetchNames, resolvers } = deferredFetch();
    const { controller, snapshots } = setup(fetchNames);

    controller.sync({ ready: true, spaceId: 'space-1' }); // resolvers[0]
    controller.sync({ ready: true, spaceId: 'space-2' }); // resolvers[1]

    // 遅れて届いた space-1 の応答は反映しない
    resolvers[0]!.resolve(new Map([['h1', 'STALE']]));
    await Promise.resolve();
    expect(snapshots.at(-1)?.names.has('h1')).toBe(false);

    resolvers[1]!.resolve(new Map([['h2', 'FRESH']]));
    await Promise.resolve();
    expect(snapshots.at(-1)?.names.get('h2')).toBe('FRESH');
  });

  it('#10 API 失敗でも throw せず status=error・空マップ（表示は止めない）', async () => {
    const { fetchNames, resolvers } = deferredFetch();
    const { controller, snapshots, onError } = setup(fetchNames);

    controller.sync({ ready: true, spaceId: 'space-1' });
    resolvers[0]!.reject(new Error('boom'));
    await Promise.resolve();
    await Promise.resolve();

    expect(snapshots.at(-1)?.status).toBe('error');
    expect(snapshots.at(-1)?.names).toBe(EMPTY_POST_AUTHOR_NAMES);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('同一 space の再 sync では再 fetch しない（連打 / 無限 retry 防止）', () => {
    const { fetchNames } = deferredFetch();
    const { controller } = setup(fetchNames);
    controller.sync({ ready: true, spaceId: 'space-1' });
    controller.sync({ ready: true, spaceId: 'space-1' });
    expect(fetchNames).toHaveBeenCalledTimes(1);
  });

  it('error 後の同一 space 再 sync でも retry しない', async () => {
    const { fetchNames, resolvers } = deferredFetch();
    const { controller } = setup(fetchNames);
    controller.sync({ ready: true, spaceId: 'space-1' });
    resolvers[0]!.reject(new Error('boom'));
    await Promise.resolve();
    await Promise.resolve();
    controller.sync({ ready: true, spaceId: 'space-1' });
    expect(fetchNames).toHaveBeenCalledTimes(1);
  });

  it('refresh: 同一 space でも強制再取得する', async () => {
    const { fetchNames, resolvers } = deferredFetch();
    const { controller, snapshots } = setup(fetchNames);
    controller.sync({ ready: true, spaceId: 'space-1' });
    resolvers[0]!.resolve(new Map([['h1', 'A']]));
    await Promise.resolve();

    controller.refresh('space-1');
    expect(fetchNames).toHaveBeenCalledTimes(2);
    resolvers[1]!.resolve(new Map([['h1', 'A2']]));
    await Promise.resolve();
    expect(snapshots.at(-1)?.names.get('h1')).toBe('A2');
  });

  it('dispose 後は応答を反映しない', async () => {
    const { fetchNames, resolvers } = deferredFetch();
    const { controller, snapshots } = setup(fetchNames);
    controller.sync({ ready: true, spaceId: 'space-1' });
    const len = snapshots.length;
    controller.dispose();
    resolvers[0]!.resolve(new Map([['h1', 'A']]));
    await Promise.resolve();
    expect(snapshots.length).toBe(len);
  });

  it('空マップ応答は共有 EMPTY インスタンスを使う（参照安定）', async () => {
    const { fetchNames, resolvers } = deferredFetch();
    const { controller, snapshots } = setup(fetchNames);
    controller.sync({ ready: true, spaceId: 'space-1' });
    resolvers[0]!.resolve(new Map());
    await Promise.resolve();
    expect(snapshots.at(-1)?.status).toBe('ready');
    expect(snapshots.at(-1)?.names).toBe(EMPTY_POST_AUTHOR_NAMES);
  });
});
