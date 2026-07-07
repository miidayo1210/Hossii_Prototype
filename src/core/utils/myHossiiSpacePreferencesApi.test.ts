import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MY_HOSSII_SPACE_PREFERENCES_STORAGE_KEY,
  fetchMyHossiiSpacePreference,
  upsertMyHossiiSpacePreference,
} from './myHossiiSpacePreferencesApi';

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

const USER_ID = '11111111-1111-1111-1111-111111111111';
const SPACE_ID = 'space-1';

describe('myHossiiSpacePreferencesApi', () => {
  beforeEach(() => {
    supabaseMock.configured = true;
    supabaseMock.from.mockReset();
  });

  it('returns true when preference row does not exist', async () => {
    supabaseMock.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    });

    await expect(fetchMyHossiiSpacePreference(USER_ID, SPACE_ID)).resolves.toBe(true);
  });

  it('returns stored visibility when preference row exists', async () => {
    supabaseMock.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { is_visible: false }, error: null }),
          }),
        }),
      }),
    });

    await expect(fetchMyHossiiSpacePreference(USER_ID, SPACE_ID)).resolves.toBe(false);
  });

  it('uses localStorage fallback when Supabase is not configured', async () => {
    supabaseMock.configured = false;
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

    await upsertMyHossiiSpacePreference(USER_ID, SPACE_ID, false);
    await expect(fetchMyHossiiSpacePreference(USER_ID, SPACE_ID)).resolves.toBe(false);

    vi.unstubAllGlobals();
  });

  it('upserts preference to database', async () => {
    const upsert = vi.fn(async () => ({ error: null }));
    supabaseMock.from.mockReturnValue({ upsert });

    await upsertMyHossiiSpacePreference(USER_ID, SPACE_ID, true);

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        space_id: SPACE_ID,
        user_id: USER_ID,
        is_visible: true,
      }),
      { onConflict: 'space_id,user_id' },
    );
  });
});

describe('RLS expectations (documented)', () => {
  it('documents storage key for mock mode', () => {
    expect(MY_HOSSII_SPACE_PREFERENCES_STORAGE_KEY).toBe('hossii.myHossiiSpacePreferences');
  });
});
