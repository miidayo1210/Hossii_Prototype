import { describe, expect, it } from 'vitest';
import type { SpacePane } from '../types/spacePane';
import {
  DEFAULT_FOLDER,
  DEFAULT_FOLDER_ID,
  ORPHAN_FOLDER_NAME,
  applyFolderStripInsert,
  buildTabBarStrip,
  migrateLegacyLocalTabFoldersIfNeeded,
  parseTabFolders,
  repositionTabFolder,
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

  it('parses beforePaneId', () => {
    expect(
      parseTabFolders([
        { id: 'a', name: 'カゴ', sortOrder: 0, beforePaneId: 'pane-2' },
        { id: 'b', name: '末尾', sortOrder: 1, beforePaneId: null },
      ]),
    ).toEqual([
      { id: 'a', name: 'カゴ', sortOrder: 0, beforePaneId: 'pane-2' },
      { id: 'b', name: '末尾', sortOrder: 1, beforePaneId: null },
    ]);
  });

  it('returns empty for invalid input', () => {
    expect(parseTabFolders(null)).toEqual([]);
    expect(parseTabFolders([{ id: '', name: 'x', sortOrder: 0 }])).toEqual([]);
  });
});

describe('buildTabBarStrip / applyFolderStripInsert', () => {
  const bar = [
    pane({ id: 'p1', name: 'Main', sortOrder: 0, isDefault: true }),
    pane({ id: 'p2', name: 'Week', sortOrder: 1 }),
  ];

  it('places folders with beforePaneId between tabs', () => {
    const folders = [
      { id: 'f1', name: 'カゴ', sortOrder: 0, beforePaneId: 'p2' },
    ];
    const strip = buildTabBarStrip(bar, folders);
    expect(strip.map((item) => (item.kind === 'pane' ? item.pane.id : item.folder.id))).toEqual([
      'p1',
      'f1',
      'p2',
    ]);
  });

  it('falls back to end when beforePaneId is missing from bar', () => {
    const folders = [
      { id: 'f1', name: 'カゴ', sortOrder: 0, beforePaneId: 'gone' },
    ];
    const strip = buildTabBarStrip(bar, folders);
    expect(strip.map((item) => (item.kind === 'pane' ? item.pane.id : item.folder.id))).toEqual([
      'p1',
      'p2',
      'f1',
    ]);
  });

  it('repositions folder before first pane via strip insert', () => {
    const folders = [{ id: 'f1', name: 'カゴ', sortOrder: 0 }];
    const next = applyFolderStripInsert(bar, folders, 'f1', 0);
    expect(next).toEqual([{ id: 'f1', name: 'カゴ', sortOrder: 0, beforePaneId: 'p1' }]);
  });

  it('repositionTabFolder updates beforePaneId', () => {
    const folders = [{ id: 'f1', name: 'カゴ', sortOrder: 0 }];
    expect(repositionTabFolder(folders, 'f1', 'p2')).toEqual([
      { id: 'f1', name: 'カゴ', sortOrder: 0, beforePaneId: 'p2' },
    ]);
    expect(repositionTabFolder(folders, 'f1', null)).toBeNull();
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
