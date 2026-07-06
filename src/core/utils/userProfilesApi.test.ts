import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PostgrestError } from '@supabase/supabase-js';

const supabaseMock = vi.hoisted(() => ({
  configured: true,
  from: vi.fn(),
}));

vi.mock('../supabase', () => ({
  get isSupabaseConfigured() {
    return supabaseMock.configured;
  },
  supabase: {
    from: (table: string) => supabaseMock.from(table),
  },
}));

import {
  MY_HOSSII_STORAGE_KEY,
  ensureUserProfileExists,
  fetchMyHossiiSettings,
  fetchUserProfile,
  isDuplicateKeyErrorForTest,
  parseMyHossiiRowForTest,
  saveMyHossiiPreset,
} from './userProfilesApi';

const USER_ID = '11111111-1111-1111-1111-111111111111';

const existingProfileRow = {
  id: USER_ID,
  username: 'たろう',
  birthdate: '2000-01-01',
  gender: 'other',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
  hossii_source_type: null,
  hossii_preset_key: null,
  hossii_updated_at: null,
};

function makeDbError(code: string, message: string): PostgrestError {
  return {
    name: 'PostgrestError',
    message,
    code,
    details: '',
    hint: '',
  };
}

type QueryResult = { data: unknown; error: PostgrestError | null };

function mockUserProfilesTable(handlers: {
  maybeSingle?: () => Promise<QueryResult> | QueryResult;
  insert?: (row: Record<string, unknown>) => Promise<{ error: PostgrestError | null }> | { error: PostgrestError | null };
  update?: (row: Record<string, unknown>) => {
    eq: (column: string, value: string) => Promise<{ error: PostgrestError | null }> | { error: PostgrestError | null };
  };
}) {
  supabaseMock.from.mockImplementation((table: string) => {
    if (table === 'user_profiles') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: handlers.maybeSingle ?? (async () => ({ data: null, error: null })),
          }),
        }),
        insert: handlers.insert ?? (async () => ({ error: null })),
        update: handlers.update ?? (() => ({
          eq: async () => ({ error: null }),
        })),
      };
    }
    if (table === 'profiles') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { default_nickname: 'スペース名' }, error: null }),
          }),
        }),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });
}

describe('userProfilesApi myHossii parsing', () => {
  it('returns empty settings when hossii columns are null', () => {
    expect(
      parseMyHossiiRowForTest({
        hossii_source_type: null,
        hossii_preset_key: null,
        hossii_updated_at: null,
      }),
    ).toEqual({
      sourceType: null,
      presetKey: null,
      updatedAt: null,
    });
  });

  it('parses valid preset settings', () => {
    expect(
      parseMyHossiiRowForTest({
        hossii_source_type: 'preset',
        hossii_preset_key: 'idle_smile',
        hossii_updated_at: '2026-07-06T00:00:00.000Z',
      }),
    ).toEqual({
      sourceType: 'preset',
      presetKey: 'idle_smile',
      updatedAt: '2026-07-06T00:00:00.000Z',
    });
  });

  it('ignores invalid preset keys', () => {
    expect(
      parseMyHossiiRowForTest({
        hossii_source_type: 'preset',
        hossii_preset_key: 'not_a_real_preset',
        hossii_updated_at: '2026-07-06T00:00:00.000Z',
      }),
    ).toEqual({
      sourceType: null,
      presetKey: null,
      updatedAt: null,
    });
  });

  it('ignores non-preset source types in Phase 1', () => {
    expect(
      parseMyHossiiRowForTest({
        hossii_source_type: 'upload',
        hossii_preset_key: 'idle_base',
        hossii_updated_at: '2026-07-06T00:00:00.000Z',
      }),
    ).toEqual({
      sourceType: null,
      presetKey: null,
      updatedAt: null,
    });
  });
});

describe('fetchUserProfile', () => {
  beforeEach(() => {
    supabaseMock.configured = true;
    supabaseMock.from.mockReset();
  });

  it('returns null when the row does not exist', async () => {
    mockUserProfilesTable({
      maybeSingle: async () => ({ data: null, error: null }),
    });

    await expect(fetchUserProfile(USER_ID)).resolves.toBeNull();
  });

  it('throws on Supabase errors such as missing columns', async () => {
    mockUserProfilesTable({
      maybeSingle: async () => ({
        data: null,
        error: makeDbError('42703', 'column hossii_source_type does not exist'),
      }),
    });

    await expect(fetchUserProfile(USER_ID)).rejects.toMatchObject({
      code: '42703',
    });
  });
});

describe('ensureUserProfileExists', () => {
  beforeEach(() => {
    supabaseMock.configured = true;
    supabaseMock.from.mockReset();
  });

  it('does not insert when an existing row is found', async () => {
    const insert = vi.fn(async () => ({ error: null }));
    mockUserProfilesTable({
      maybeSingle: async () => ({ data: existingProfileRow, error: null }),
      insert,
    });

    const profile = await ensureUserProfileExists(USER_ID);

    expect(insert).not.toHaveBeenCalled();
    expect(profile.username).toBe('たろう');
    expect(profile.birthdate).toBe('2000-01-01');
    expect(profile.gender).toBe('other');
    expect(profile.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('does not insert when fetch fails', async () => {
    const insert = vi.fn(async () => ({ error: null }));
    mockUserProfilesTable({
      maybeSingle: async () => ({
        data: null,
        error: makeDbError('PGRST301', 'JWT expired'),
      }),
      insert,
    });

    await expect(ensureUserProfileExists(USER_ID)).rejects.toMatchObject({
      code: 'PGRST301',
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it('inserts only when the row is missing', async () => {
    let fetchCount = 0;
    const insert = vi.fn(async (row: Record<string, unknown>) => {
      expect(row).toEqual({ id: USER_ID, username: 'スペース名' });
      return { error: null };
    });

    mockUserProfilesTable({
      maybeSingle: async () => {
        fetchCount += 1;
        if (fetchCount === 1) return { data: null, error: null };
        return { data: { ...existingProfileRow, username: 'スペース名' }, error: null };
      },
      insert,
    });

    const profile = await ensureUserProfileExists(USER_ID);

    expect(insert).toHaveBeenCalledTimes(1);
    expect(profile.username).toBe('スペース名');
  });

  it('treats duplicate key as already created without updating existing row', async () => {
    let fetchCount = 0;
    const insert = vi.fn(async () => ({
      error: makeDbError('23505', 'duplicate key value violates unique constraint'),
    }));

    mockUserProfilesTable({
      maybeSingle: async () => {
        fetchCount += 1;
        if (fetchCount === 1) return { data: null, error: null };
        return { data: existingProfileRow, error: null };
      },
      insert,
    });

    const profile = await ensureUserProfileExists(USER_ID);

    expect(insert).toHaveBeenCalledTimes(1);
    expect(profile.username).toBe('たろう');
    expect(profile.birthdate).toBe('2000-01-01');
  });
});

describe('saveMyHossiiPreset', () => {
  beforeEach(() => {
    supabaseMock.configured = true;
    supabaseMock.from.mockReset();
  });

  it('throws for invalid preset keys', async () => {
    await expect(saveMyHossiiPreset(USER_ID, 'invalid_key')).rejects.toThrow('無効なプリセットです');
  });

  it('throws on DB update failure and does not write to localStorage', async () => {
    const storage: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
    });

    mockUserProfilesTable({
      maybeSingle: async () => ({ data: existingProfileRow, error: null }),
      update: () => ({
        eq: async () => ({ error: makeDbError('42501', 'permission denied') }),
      }),
    });

    await expect(saveMyHossiiPreset(USER_ID, 'idle_base')).rejects.toMatchObject({
      code: '42501',
    });
    expect(storage[MY_HOSSII_STORAGE_KEY]).toBeUndefined();

    vi.unstubAllGlobals();
  });

  it('updates only hossii columns on save', async () => {
    const update = vi.fn((row: Record<string, unknown>) => ({
      eq: async (_column: string, value: string) => {
        expect(value).toBe(USER_ID);
        expect(row).toEqual({
          hossii_source_type: 'preset',
          hossii_preset_key: 'idle_smile',
          hossii_updated_at: expect.any(String),
          updated_at: expect.any(String),
        });
        return { error: null };
      },
    }));

    mockUserProfilesTable({
      maybeSingle: async () => ({ data: existingProfileRow, error: null }),
      update,
    });

    const saved = await saveMyHossiiPreset(USER_ID, 'idle_smile');

    expect(update).toHaveBeenCalledTimes(1);
    expect(saved).toEqual({
      sourceType: 'preset',
      presetKey: 'idle_smile',
      updatedAt: expect.any(String),
    });
  });
});

describe('localStorage fallback (Supabase not configured)', () => {
  const storage: Record<string, string> = {};

  beforeEach(() => {
    supabaseMock.configured = false;
    supabaseMock.from.mockReset();
    Object.keys(storage).forEach((key) => delete storage[key]);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('saves and loads settings per userId', async () => {
    const userA = 'user-a';
    const userB = 'user-b';

    await saveMyHossiiPreset(userA, 'idle_base');
    await saveMyHossiiPreset(userB, 'idle_smile');

    await expect(fetchMyHossiiSettings(userA)).resolves.toEqual({
      sourceType: 'preset',
      presetKey: 'idle_base',
      updatedAt: expect.any(String),
    });
    await expect(fetchMyHossiiSettings(userB)).resolves.toEqual({
      sourceType: 'preset',
      presetKey: 'idle_smile',
      updatedAt: expect.any(String),
    });
  });
});

describe('isDuplicateKeyErrorForTest', () => {
  it('detects postgres duplicate key errors', () => {
    expect(isDuplicateKeyErrorForTest({ code: '23505' })).toBe(true);
    expect(isDuplicateKeyErrorForTest({ code: '42501' })).toBe(false);
  });
});
