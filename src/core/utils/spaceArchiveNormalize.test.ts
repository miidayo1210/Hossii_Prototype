import { describe, expect, it } from 'vitest';
import { normalizeSpace } from '../hooks/HossiiStoreProvider';

describe('normalizeSpace archive fields', () => {
  it('preserves isArchived / archivedAt / archivedBy from raw space', () => {
    const space = normalizeSpace({
      id: 's1',
      name: 'Archived Space',
      quickEmotions: [],
      createdAt: new Date('2026-01-01').toISOString(),
      isArchived: true,
      archivedAt: '2026-07-15T00:00:00.000Z',
      archivedBy: 'admin-1',
    });
    expect(space.isArchived).toBe(true);
    expect(space.archivedAt).toEqual(new Date('2026-07-15T00:00:00.000Z'));
    expect(space.archivedBy).toBe('admin-1');
  });

  it('defaults isArchived to false when absent', () => {
    const space = normalizeSpace({
      id: 's1',
      name: 'Normal',
      quickEmotions: [],
      createdAt: new Date('2026-01-01').toISOString(),
    });
    expect(space.isArchived).toBe(false);
    expect(space.archivedAt).toBeUndefined();
  });
});
