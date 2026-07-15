import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('./../supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { rpc: h.rpc },
}));

import { buildInviteUrl, createCommunityInvitation, acceptCommunityInvitation } from './communityInvitationsApi';

describe('buildInviteUrl', () => {
  it('hash ルートに token を載せる（console 出力はしない）', () => {
    const url = buildInviteUrl('abc-token');
    expect(url).toContain('#community-invite/');
    expect(url).toContain(encodeURIComponent('abc-token'));
  });
});

describe('createCommunityInvitation', () => {
  beforeEach(() => h.rpc.mockReset());

  it('admin_create_community_invitation を呼ぶ', async () => {
    h.rpc.mockResolvedValue({
      data: [{ invitation_id: 'i1', invite_token: 'secret', expires_at: '2099-01-01' }],
      error: null,
    });
    const res = await createCommunityInvitation('c1', 'User@Example.COM');
    expect(res.ok).toBe(true);
    expect(h.rpc).toHaveBeenCalledWith('admin_create_community_invitation', {
      p_community_id: 'c1',
      p_invitee_email: 'User@Example.COM',
      p_role: 'member',
      p_expires_in_hours: 168,
    });
  });
});

describe('acceptCommunityInvitation', () => {
  beforeEach(() => h.rpc.mockReset());

  it('エラー時は汎用メッセージを返す', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: 'invitation invalid' } });
    const res = await acceptCommunityInvitation('bad');
    expect(res.ok).toBe(false);
  });
});
