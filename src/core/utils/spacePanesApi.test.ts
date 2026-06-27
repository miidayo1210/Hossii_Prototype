import { describe, expect, it, vi } from 'vitest';

vi.mock('../supabase', () => ({
  isSupabaseConfigured: false,
  supabase: { from: vi.fn() },
}));

import type { Hossii } from '../types';
import {
  buildHossiiInsertPayload,
  rowToHossii,
  type HossiiRow,
} from './hossiisApi';
import {
  defaultSpacePaneId,
  rowToSpacePane,
  validateHossiiPaneSpaceMatch,
  type SpacePaneRow,
} from './spacePanesApi';
import {
  ensureDefaultSpacePane,
  resetEnsureDefaultSpacePaneState,
} from './ensureDefaultSpacePane';

const baseHossii: Hossii = {
  id: 'h1',
  message: 'hello',
  spaceId: 'space-1',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  origin: 'manual',
  isPositionFixed: false,
  scale: 1,
  isHidden: false,
  likeCount: 0,
  postKind: 'bubble',
};

describe('buildHossiiInsertPayload', () => {
  it('omits space_pane_id when spacePaneId is undefined', () => {
    const payload = buildHossiiInsertPayload(baseHossii);
    expect(payload).not.toHaveProperty('space_pane_id');
  });

  it('omits space_pane_id when spacePaneId is null', () => {
    const payload = buildHossiiInsertPayload({ ...baseHossii, spacePaneId: null });
    expect(payload).not.toHaveProperty('space_pane_id');
  });

  it('includes space_pane_id when explicitly set', () => {
    const paneId = defaultSpacePaneId('space-1');
    const payload = buildHossiiInsertPayload({ ...baseHossii, spacePaneId: paneId });
    expect(payload.space_pane_id).toBe(paneId);
  });
});

describe('rowToHossii spacePaneId mapping', () => {
  it('maps space_pane_id from DB row', () => {
    const row: HossiiRow = {
      id: 'h1',
      message: 'x',
      emotion: null,
      space_id: 'space-1',
      space_pane_id: 'space-1-pane-default',
      author_id: null,
      author_name: null,
      origin: 'manual',
      auto_type: null,
      speech_level: null,
      language: null,
      log_type: null,
      created_at: '2026-01-01T00:00:00.000Z',
      bubble_color: null,
      hashtags: null,
      tags: null,
      image_url: null,
      position_x: null,
      position_y: null,
      is_position_fixed: false,
      scale: 1,
      is_hidden: false,
      hidden_at: null,
      hidden_by: null,
      number_value: null,
      like_count: 0,
    };
    expect(rowToHossii(row).spacePaneId).toBe('space-1-pane-default');
  });

  it('leaves spacePaneId undefined when DB column is null', () => {
    const row: HossiiRow = {
      ...({
        id: 'h2',
        message: 'y',
        emotion: null,
        space_id: 'space-1',
        space_pane_id: null,
        author_id: null,
        author_name: null,
        origin: 'manual',
        auto_type: null,
        speech_level: null,
        language: null,
        log_type: null,
        created_at: '2026-01-01T00:00:00.000Z',
        bubble_color: null,
        hashtags: null,
        tags: null,
        image_url: null,
        position_x: null,
        position_y: null,
        is_position_fixed: false,
        scale: 1,
        is_hidden: false,
        hidden_at: null,
        hidden_by: null,
        number_value: null,
        like_count: 0,
      } satisfies HossiiRow),
    };
    expect(rowToHossii(row).spacePaneId).toBeUndefined();
  });
});

describe('validateHossiiPaneSpaceMatch', () => {
  it('allows legacy posts without pane id', () => {
    expect(validateHossiiPaneSpaceMatch({ spaceId: 's1', spacePaneId: undefined }, 's1')).toBe(true);
    expect(validateHossiiPaneSpaceMatch({ spaceId: 's1', spacePaneId: null }, 's1')).toBe(true);
  });

  it('accepts matching pane space', () => {
    expect(
      validateHossiiPaneSpaceMatch(
        { spaceId: 's1', spacePaneId: 's1-pane-default' },
        's1',
      ),
    ).toBe(true);
  });

  it('rejects cross-space pane assignment', () => {
    expect(
      validateHossiiPaneSpaceMatch(
        { spaceId: 's1', spacePaneId: 's2-pane-default' },
        's2',
      ),
    ).toBe(false);
  });
});

describe('defaultSpacePaneId', () => {
  it('uses deterministic id pattern', () => {
    expect(defaultSpacePaneId('abc')).toBe('abc-pane-default');
  });
});

describe('rowToSpacePane', () => {
  it('maps snake_case row to SpacePane', () => {
    const row: SpacePaneRow = {
      id: 'space-1-pane-default',
      space_id: 'space-1',
      name: 'メイン',
      slug: 'main',
      sort_order: 0,
      is_default: true,
      is_visible: true,
      background: null,
      saved_background_images: null,
      decorations: null,
      character_image_url: null,
      character_name: null,
      custom_emotions: null,
      bubble_shape_png: null,
      settings: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };
    const pane = rowToSpacePane(row);
    expect(pane.spaceId).toBe('space-1');
    expect(pane.isDefault).toBe(true);
    expect(pane.slug).toBe('main');
  });
});

describe('ensureDefaultSpacePane dedup', () => {
  it('returns null immediately when Supabase is not configured', async () => {
    resetEnsureDefaultSpacePaneState();
    await expect(ensureDefaultSpacePane('space-x')).resolves.toBeNull();
  });
});
