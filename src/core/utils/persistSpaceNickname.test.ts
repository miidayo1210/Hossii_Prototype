import { beforeEach, describe, expect, it, vi } from 'vitest';

const profilesApiMock = vi.hoisted(() => ({
  upsertSpaceNickname: vi.fn(async () => undefined),
}));

const spaceMembershipsApiMock = vi.hoisted(() => ({
  updateMySpaceNickname: vi.fn(async () => ({ ok: true as const, nickname: 'みー' })),
}));

vi.mock('../supabase', () => ({
  isSupabaseConfigured: true,
}));

vi.mock('./profilesApi', () => ({
  upsertSpaceNickname: profilesApiMock.upsertSpaceNickname,
}));

vi.mock('./spaceMembershipsApi', () => ({
  updateMySpaceNickname: spaceMembershipsApiMock.updateMySpaceNickname,
}));

import { persistSpaceNickname } from './persistSpaceNickname';

describe('persistSpaceNickname', () => {
  beforeEach(() => {
    profilesApiMock.upsertSpaceNickname.mockClear();
    spaceMembershipsApiMock.updateMySpaceNickname.mockClear();
    profilesApiMock.upsertSpaceNickname.mockResolvedValue(undefined);
    spaceMembershipsApiMock.updateMySpaceNickname.mockResolvedValue({
      ok: true,
      nickname: 'みー',
    });
  });

  it('trims and saves to issuing space id', async () => {
    await persistSpaceNickname({
      profileId: 'user-1',
      spaceId: 'space-issued',
      nickname: '  みー  ',
    });

    expect(profilesApiMock.upsertSpaceNickname).toHaveBeenCalledWith(
      'user-1',
      'space-issued',
      'みー',
    );
    expect(spaceMembershipsApiMock.updateMySpaceNickname).toHaveBeenCalledWith(
      'space-issued',
      'みー',
    );
  });

  it('rejects empty nickname', async () => {
    await expect(
      persistSpaceNickname({
        profileId: 'user-1',
        spaceId: 'space-issued',
        nickname: '   ',
      }),
    ).rejects.toThrow('nickname is empty');
    expect(profilesApiMock.upsertSpaceNickname).not.toHaveBeenCalled();
  });

  it('fails when space_nicknames upsert fails', async () => {
    profilesApiMock.upsertSpaceNickname.mockRejectedValueOnce(new Error('upsert failed'));
    await expect(
      persistSpaceNickname({
        profileId: 'user-1',
        spaceId: 'space-issued',
        nickname: 'みー',
      }),
    ).rejects.toThrow('upsert failed');
  });

  it('succeeds even if membership nickname sync fails', async () => {
    spaceMembershipsApiMock.updateMySpaceNickname.mockResolvedValueOnce({
      ok: false,
      message: 'membership not found',
    });
    await expect(
      persistSpaceNickname({
        profileId: 'user-1',
        spaceId: 'space-issued',
        nickname: 'みー',
      }),
    ).resolves.toBeUndefined();
    expect(profilesApiMock.upsertSpaceNickname).toHaveBeenCalled();
  });
});
