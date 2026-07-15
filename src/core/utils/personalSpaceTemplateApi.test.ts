import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => {
  // 単一の結果スロットを共有し、fetch/save 両方のチェーンで解決する。
  const result: { data: unknown; error: unknown } = { data: null, error: null };
  const calls: { method: string; args: unknown[] }[] = [];

  const builder: Record<string, unknown> = {};
  const chain = (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  // チェーン用（builder を返す）
  builder.select = chain('select');
  builder.update = chain('update');
  builder.eq = chain('eq');
  // 終端（Promise を返す）
  builder.maybeSingle = (...args: unknown[]) => {
    calls.push({ method: 'maybeSingle', args });
    return Promise.resolve(result);
  };
  // save 側は `.select('id')` を await する → builder 自体を thenable にする
  builder.then = (resolve: (v: unknown) => unknown) => resolve(result);

  const from = vi.fn((..._args: unknown[]) => {
    calls.push({ method: 'from', args: _args });
    return builder;
  });

  return { result, calls, from };
});

vi.mock('./../supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { from: h.from },
}));

import {
  fetchCommunityPersonalSpaceTemplate,
  saveCommunityPersonalSpaceTemplate,
} from './personalSpaceTemplateApi';

beforeEach(() => {
  h.calls.length = 0;
  h.result.data = null;
  h.result.error = null;
  h.from.mockClear();
});

describe('fetchCommunityPersonalSpaceTemplate', () => {
  it('communityId が空なら null を返し DB を呼ばない', async () => {
    expect(await fetchCommunityPersonalSpaceTemplate('')).toBeNull();
    expect(h.from).not.toHaveBeenCalled();
  });

  it('テンプレート未設定なら null を返す', async () => {
    h.result.data = { personal_space_template: null };
    expect(await fetchCommunityPersonalSpaceTemplate('c1')).toBeNull();
    expect(h.from).toHaveBeenCalledWith('communities');
  });

  it('テンプレートを返す', async () => {
    h.result.data = { personal_space_template: { enabled: true, name_pattern: 'ふりかえり' } };
    const t = await fetchCommunityPersonalSpaceTemplate('c1');
    expect(t).toEqual({ enabled: true, name_pattern: 'ふりかえり' });
  });

  it('エラー時は throw する', async () => {
    h.result.error = { message: 'boom' };
    await expect(fetchCommunityPersonalSpaceTemplate('c1')).rejects.toThrow(/boom/);
  });
});

describe('saveCommunityPersonalSpaceTemplate', () => {
  it('communityId が空なら ok:false（DB を呼ばない）', async () => {
    const res = await saveCommunityPersonalSpaceTemplate('', { enabled: true });
    expect(res.ok).toBe(false);
    expect(h.from).not.toHaveBeenCalled();
  });

  it('更新成功（1 行）なら ok:true', async () => {
    h.result.data = [{ id: 'c1' }];
    const res = await saveCommunityPersonalSpaceTemplate('c1', { enabled: true });
    expect(res).toEqual({ ok: true });
    expect(h.from).toHaveBeenCalledWith('communities');
  });

  it('0 行更新（RLS ブロック）なら ok:false', async () => {
    h.result.data = [];
    const res = await saveCommunityPersonalSpaceTemplate('c1', { enabled: true });
    expect(res.ok).toBe(false);
  });

  it('エラー時は ok:false（code 付き）', async () => {
    h.result.error = { message: 'denied', code: '42501' };
    const res = await saveCommunityPersonalSpaceTemplate('c1', { enabled: true });
    expect(res).toEqual({ ok: false, message: 'denied', code: '42501' });
  });
});
