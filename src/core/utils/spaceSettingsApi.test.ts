import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  parseSpaceSettingsRow,
  timelineDepthEnabledToDbColumn,
  updateTimelineDepthEnabled,
  hossiiGuideToJson,
} from './spaceSettingsApi';
import { resolvePostFields } from './postFieldSettings';

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

describe('parseSpaceSettingsRow', () => {
  it('reads feature_message_post when present', () => {
    const settings = parseSpaceSettingsRow(
      {
        space_id: 's1',
        feature_message_post: false,
        feature_likes_enabled: true,
        bottle_frequency: '3d-7d',
      },
      'Test',
    );
    expect(settings.features.messagePost).toBe(false);
  });

  it('falls back to feature_comment_post for legacy rows', () => {
    const settings = parseSpaceSettingsRow(
      {
        space_id: 's1',
        feature_comment_post: false,
        feature_likes_enabled: true,
        bottle_frequency: '3d-7d',
      },
      'Test',
    );
    expect(settings.features.messagePost).toBe(false);
  });

  it('resolves message.enabled from legacy features when post_fields absent', () => {
    const settings = parseSpaceSettingsRow(
      {
        space_id: 's1',
        feature_comment_post: false,
        feature_emotion_post: true,
        feature_photo_post: true,
        feature_number_post: false,
        feature_likes_enabled: true,
        bottle_frequency: '3d-7d',
      },
      'Test',
    );
    const pf = resolvePostFields(settings);
    expect(pf.message.enabled).toBe(false);
    expect(pf.emotion.enabled).toBe(true);
  });

  it('parses timeline_depth_enabled true as app true', () => {
    const settings = parseSpaceSettingsRow(
      { space_id: 's1', timeline_depth_enabled: true, bottle_frequency: '3d-7d' },
      'Test',
    );
    expect(settings.timelineDepthEnabled).toBe(true);
  });

  it('parses timeline_depth_enabled false as app false', () => {
    const settings = parseSpaceSettingsRow(
      { space_id: 's1', timeline_depth_enabled: false, bottle_frequency: '3d-7d' },
      'Test',
    );
    expect(settings.timelineDepthEnabled).toBe(false);
  });

  it('parses missing timeline_depth_enabled as app false', () => {
    const settings = parseSpaceSettingsRow(
      { space_id: 's1', bottle_frequency: '3d-7d' },
      'Test',
    );
    expect(settings.timelineDepthEnabled).toBe(false);
  });

  it('parses hossii_guide JSONB into hossiiGuide settings', () => {
    const settings = parseSpaceSettingsRow(
      {
        space_id: 's1',
        bottle_frequency: '3d-7d',
        hossii_guide: { enabled: true, mode: 'package', packageKey: 'reflection' },
      },
      'Test',
    );
    expect(settings.hossiiGuide).toEqual({
      enabled: true,
      mode: 'package',
      packageKey: 'reflection',
    });
  });

  it('omits hossiiGuide when column is null', () => {
    const settings = parseSpaceSettingsRow(
      { space_id: 's1', bottle_frequency: '3d-7d', hossii_guide: null },
      'Test',
    );
    expect(settings.hossiiGuide).toBeUndefined();
  });
});

describe('hossiiGuideToJson', () => {
  it('serializes enabled guide settings', () => {
    expect(
      hossiiGuideToJson({ enabled: true, mode: 'package', packageKey: 'ideas' }),
    ).toEqual({ enabled: true, mode: 'package', packageKey: 'ideas' });
  });

  it('returns null when guide is undefined', () => {
    expect(hossiiGuideToJson(undefined)).toBeNull();
  });
});

describe('timelineDepthEnabledToDbColumn', () => {
  it('serializes true', () => {
    expect(timelineDepthEnabledToDbColumn(true)).toEqual({ timeline_depth_enabled: true });
  });

  it('serializes false', () => {
    expect(timelineDepthEnabledToDbColumn(false)).toEqual({ timeline_depth_enabled: false });
  });
});

describe('updateTimelineDepthEnabled', () => {
  beforeEach(() => {
    supabaseMock.configured = true;
    supabaseMock.from.mockReset();
  });

  it('updates only timeline_depth_enabled on existing row', async () => {
    const update = vi.fn().mockResolvedValue({ error: null });
    const insert = vi.fn();

    supabaseMock.from.mockImplementation((table: string) => {
      expect(table).toBe('space_settings');
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: { space_id: 's1' }, error: null }),
          }),
        }),
        update: (payload: Record<string, unknown>) => {
          expect(payload).toEqual({ timeline_depth_enabled: true });
          return {
            eq: () => update(),
          };
        },
        insert,
      };
    });

    await updateTimelineDepthEnabled('s1', true);
    expect(update).toHaveBeenCalledOnce();
    expect(insert).not.toHaveBeenCalled();
  });

  it('inserts only space_id and timeline_depth_enabled when row is missing', async () => {
    const update = vi.fn();
    const insert = vi.fn().mockResolvedValue({ error: null });

    supabaseMock.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
      update,
      insert: (payload: Record<string, unknown>) => {
        expect(payload).toEqual({ space_id: 's2', timeline_depth_enabled: false });
        return insert();
      },
    }));

    await updateTimelineDepthEnabled('s2', false);
    expect(insert).toHaveBeenCalledOnce();
    expect(update).not.toHaveBeenCalled();
  });

  it('propagates DB errors', async () => {
    const dbError = { message: 'Only space administrators can change timeline depth settings.' };

    supabaseMock.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: { space_id: 's1' }, error: null }),
        }),
      }),
      update: () => ({
        eq: () => Promise.resolve({ error: dbError }),
      }),
      insert: vi.fn(),
    }));

    await expect(updateTimelineDepthEnabled('s1', true)).rejects.toEqual(dbError);
  });

  it('no-ops when Supabase is not configured', async () => {
    supabaseMock.configured = false;
    await updateTimelineDepthEnabled('s1', true);
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });
});
