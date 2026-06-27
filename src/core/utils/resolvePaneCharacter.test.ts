import { describe, expect, it } from 'vitest';
import type { Space } from '../types/space';
import type { SpacePane } from '../types/spacePane';
import { resolvePaneCharacter } from './resolvePaneCharacter';

const baseSpace: Space = {
  id: 'space-1',
  name: 'Test',
  spaceURL: 'test',
  characterName: 'Hossii',
  characterImageUrl: '/space.png',
  customEmotions: [{ id: 'e1', imageUrl: '/e.png', width: 80, height: 80 }],
  createdAt: new Date(),
};

const defaultPane: SpacePane = {
  id: 'pane-default',
  spaceId: 'space-1',
  name: 'Main',
  slug: 'main',
  sortOrder: 0,
  isDefault: true,
  isVisible: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('resolvePaneCharacter', () => {
  it('returns space character for default pane', () => {
    expect(resolvePaneCharacter(defaultPane, baseSpace).characterName).toBe('Hossii');
  });

  it('returns pane override per field', () => {
    const pane: SpacePane = {
      ...defaultPane,
      id: 'pane-2',
      isDefault: false,
      characterName: 'PaneChar',
      characterImageUrl: null,
      customEmotions: null,
    };
    const resolved = resolvePaneCharacter(pane, baseSpace);
    expect(resolved.characterName).toBe('PaneChar');
    expect(resolved.characterImageUrl).toBe('/space.png');
    expect(resolved.customEmotions).toEqual(baseSpace.customEmotions);
  });
});
