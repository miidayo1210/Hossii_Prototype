import { describe, expect, it } from 'vitest';
import type { SpacePane } from '../types/spacePane';
import {
  DEFAULT_FOLDER,
  DEFAULT_FOLDER_ID,
  ORPHAN_FOLDER_NAME,
  migrateLegacyLocalTabFoldersIfNeeded,
  parseTabFolders,
  resolveEffectiveTabFolders,
} from './tabFolderStorage';

const now = new Date();

function pane(overrides: Partial<SpacePane> & Pick<SpacePane, 'id'>): SpacePane {
  return {
    spaceId: 'space-1',
    name: 'Tab',
    slug: 'tab',
    sortOrder: 0,
    isDefault: false,
    isVisible: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('parseTabFolders', () => {
  it('parses valid folder rows', () => {
    expect(
      parseTabFolders([
        { id: 'a', name: 'Spring', sortOrder: 1 },
        { id: 'b', name: 'Archive', sortOrder: 0 },
      ]),
    ).toEqual([
      { id: 'b', name: 'Archive', sortOrder: 0 },
      { id: 'a', name: 'Spring', sortOrder: 1 },
    ]);
  });

  it('returns empty for invalid input', () => {
    expect(parseTabFolders(null)).toEqual([]);
    expect(parseTabFolders([{ id: '', name: 'x', sortOrder: 0 }])).toEqual([]);
  });
});

describe('resolveEffectiveTabFolders', () => {
  it('injects virtual default folder when panes use default id', () => {
    const visible = [
      pane({ id: 'main', isDefault: true }),
      pane({
        id: 'b',
        settings: { tabBar: { group: 'folder', folderId: DEFAULT_FOLDER_ID } },
      }),
    ];
    const effective = resolveEffectiveTabFolders([], visible, { isAdmin: false });
    expect(effective).toEqual([DEFAULT_FOLDER]);
  });

  it('synthesizes orphan folder chips for unknown folder ids', () => {
    const visible = [
      pane({ id: 'main', isDefault: true }),
      pane({
        id: 'hidden-tab',
        name: 'Hidden',
        settings: { tabBar: { group: 'folder', folderId: 'f-orphan' } },
      }),
    ];
    const effective = resolveEffectiveTabFolders([], visible, { isAdmin: false });
    expect(effective.some((f) => f.id === 'f-orphan' && f.name === ORPHAN_FOLDER_NAME)).toBe(true);
  });

  it('uses stored folder names from space', () => {
    const visible = [
      pane({ id: 'main', isDefault: true }),
      pane({
        id: 'b',
        settings: { tabBar: { group: 'folder', folderId: 'f1' } },
      }),
    ];
    const effective = resolveEffectiveTabFolders(
      [{ id: 'f1', name: '2025春', sortOrder: 0 }],
      visible,
      { isAdmin: false },
    );
    expect(effective).toEqual([{ id: 'f1', name: '2025春', sortOrder: 0 }]);
  });
});

describe('migrateLegacyLocalTabFoldersIfNeeded', () => {
  it('returns null when space already has folders', () => {
    expect(
      migrateLegacyLocalTabFoldersIfNeeded('space-1', [{ id: 'f1', name: 'A', sortOrder: 0 }]),
    ).toBeNull();
  });
});
