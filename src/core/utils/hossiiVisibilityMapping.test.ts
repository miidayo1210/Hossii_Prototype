import { describe, expect, it, vi } from 'vitest';

vi.mock('../supabase', () => ({
  isSupabaseConfigured: false,
  supabase: { from: () => ({}), rpc: () => ({}) },
}));

import { coerceVisibility, rowToHossii, type HossiiRow } from './hossiisApi';

const baseRow: HossiiRow = {
  id: 'h1',
  message: 'hello',
  emotion: null,
  space_id: 'space-1',
  author_id: 'a1',
  author_name: 'Taro',
  origin: 'manual',
  auto_type: null,
  speech_level: null,
  language: null,
  log_type: null,
  created_at: '2026-07-13T00:00:00.000Z',
  bubble_color: null,
  hashtags: null,
  tags: null,
  image_url: null,
  position_x: null,
  position_y: null,
  is_position_fixed: null,
  scale: null,
  is_hidden: null,
  hidden_at: null,
  hidden_by: null,
  number_value: null,
  like_count: 0,
};

describe('coerceVisibility', () => {
  it('maps owner_only', () => {
    expect(coerceVisibility('owner_only')).toBe('owner_only');
  });
  it('maps public', () => {
    expect(coerceVisibility('public')).toBe('public');
  });
  it('falls back to public for null / undefined / unknown', () => {
    expect(coerceVisibility(null)).toBe('public');
    expect(coerceVisibility(undefined)).toBe('public');
    expect(coerceVisibility('nonsense')).toBe('public');
    expect(coerceVisibility(0)).toBe('public');
  });
});

describe('rowToHossii Phase 2D-1 fields', () => {
  it('maps visibility / deleted_at / content_edited_at when present', () => {
    const h = rowToHossii({
      ...baseRow,
      visibility: 'owner_only',
      deleted_at: '2026-07-13T01:00:00.000Z',
      content_edited_at: '2026-07-13T02:00:00.000Z',
    });
    expect(h.visibility).toBe('owner_only');
    expect(h.deletedAt).toEqual(new Date('2026-07-13T01:00:00.000Z'));
    expect(h.contentEditedAt).toEqual(new Date('2026-07-13T02:00:00.000Z'));
  });

  it('applies fallbacks (public / null / null) for legacy rows missing the columns', () => {
    const h = rowToHossii(baseRow);
    expect(h.visibility).toBe('public');
    expect(h.deletedAt).toBeNull();
    expect(h.contentEditedAt).toBeNull();
  });

  it('treats explicit null columns as fallbacks', () => {
    const h = rowToHossii({
      ...baseRow,
      visibility: null,
      deleted_at: null,
      content_edited_at: null,
    });
    expect(h.visibility).toBe('public');
    expect(h.deletedAt).toBeNull();
    expect(h.contentEditedAt).toBeNull();
  });
});

describe('rowToHossii tags / hashtags', () => {
  it('maps array tags and hashtags', () => {
    const h = rowToHossii({
      ...baseRow,
      tags: ['質問'],
      hashtags: ['free'],
    });
    expect(h.tags).toEqual(['質問']);
    expect(h.hashtags).toEqual(['free']);
  });

  it('drops non-array tags/hashtags (e.g. unexpected jsonb object)', () => {
    const h = rowToHossii({
      ...baseRow,
      tags: { bad: true } as unknown as string[],
      hashtags: 'not-an-array' as unknown as string[],
    });
    expect(h.tags).toBeUndefined();
    expect(h.hashtags).toBeUndefined();
  });
});
