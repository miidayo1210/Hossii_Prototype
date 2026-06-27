import { describe, expect, it } from 'vitest';
import type { SpacePane } from '../types/spacePane';
import { resolveActivePane } from './resolveActivePane';

const now = new Date('2026-01-01');

function pane(overrides: Partial<SpacePane> & Pick<SpacePane, 'id' | 'slug'>): SpacePane {
  return {
    spaceId: 'space-1',
    name: overrides.slug,
    sortOrder: 0,
    isDefault: false,
    isVisible: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const defaultPane = pane({
  id: 'space-1-pane-default',
  slug: 'main',
  name: 'メイン',
  isDefault: true,
});

const ideasPane = pane({ id: 'space-1-pane-ideas', slug: 'ideas', name: 'アイデア' });

describe('resolveActivePane', () => {
  it('returns default when pane slug is absent', () => {
    const result = resolveActivePane({
      paneSlug: null,
      visiblePanes: [defaultPane, ideasPane],
      defaultPane,
    });
    expect(result.activePane.id).toBe(defaultPane.id);
    expect(result.shouldSanitizeUrl).toBe(false);
  });

  it('returns matching visible pane for valid slug', () => {
    const result = resolveActivePane({
      paneSlug: 'ideas',
      visiblePanes: [defaultPane, ideasPane],
      defaultPane,
    });
    expect(result.activePane.id).toBe(ideasPane.id);
    expect(result.shouldSanitizeUrl).toBe(false);
  });

  it('falls back to default and sanitizes for unknown slug', () => {
    const result = resolveActivePane({
      paneSlug: 'missing',
      visiblePanes: [defaultPane, ideasPane],
      defaultPane,
    });
    expect(result.activePane.id).toBe(defaultPane.id);
    expect(result.shouldSanitizeUrl).toBe(true);
  });

  it('falls back to default for hidden pane slug even if in full panes list', () => {
    const hiddenPane = pane({
      id: 'space-1-pane-hidden',
      slug: 'hidden',
      isVisible: false,
    });
    const result = resolveActivePane({
      paneSlug: 'hidden',
      visiblePanes: [defaultPane],
      defaultPane,
    });
    expect(result.activePane.id).toBe(defaultPane.id);
    expect(result.shouldSanitizeUrl).toBe(true);
    expect(hiddenPane.isVisible).toBe(false);
  });
});
