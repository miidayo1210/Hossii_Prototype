import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Space } from '../types/space';
import type { SpacePane } from '../types/spacePane';
import type { SpaceSettings } from '../types/settings';

const { updateSpaceInDb, updateSpacePane } = vi.hoisted(() => ({
  updateSpaceInDb: vi.fn().mockResolvedValue(undefined),
  updateSpacePane: vi.fn().mockResolvedValue({ id: 'pane-2' }),
}));

vi.mock('../supabase', () => ({
  isSupabaseConfigured: true,
}));

vi.mock('./spacesApi', () => ({
  updateSpaceInDb,
}));

vi.mock('./spacePanesApi', () => ({
  updateSpacePane,
}));

import { savePaneBubbleShapeOverride } from './savePaneSettingOverride';

const baseSpace: Space = {
  id: 'space-1',
  name: 'Test Space',
  quickEmotions: [],
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  bubbleShapePng: '/assets/bubble-shapes/speech.png',
};

const defaultPane: SpacePane = {
  id: 'space-1-pane-default',
  spaceId: 'space-1',
  name: 'Default',
  slug: 'default',
  sortOrder: 0,
  isDefault: true,
  isVisible: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const additionalPane: SpacePane = {
  id: 'pane-2',
  spaceId: 'space-1',
  name: 'Ideas',
  slug: 'ideas',
  sortOrder: 1,
  isDefault: false,
  isVisible: true,
  bubbleShapePng: '/assets/bubble-shapes/speech.png',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const settings = {} as SpaceSettings;

function makeContext(pane: SpacePane) {
  const onUpdateSpace = vi.fn();
  const reloadPanesAndSyncActive = vi.fn().mockResolvedValue(undefined);
  return {
    ctx: {
      editPane: pane,
      space: baseSpace,
      settings,
      onUpdateSpace,
      onUpdateSettings: vi.fn(),
      reloadPanesAndSyncActive,
    },
    onUpdateSpace,
    reloadPanesAndSyncActive,
  };
}

describe('savePaneBubbleShapeOverride', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips update when bubble shape is unchanged', async () => {
    const { ctx, onUpdateSpace } = makeContext(defaultPane);

    await savePaneBubbleShapeOverride(ctx, undefined);

    expect(updateSpaceInDb).not.toHaveBeenCalled();
    expect(updateSpacePane).not.toHaveBeenCalled();
    expect(onUpdateSpace).not.toHaveBeenCalled();
  });

  it('clears default pane bubble shape with null', async () => {
    const { ctx, onUpdateSpace } = makeContext(defaultPane);

    await savePaneBubbleShapeOverride(ctx, null);

    expect(onUpdateSpace).toHaveBeenCalledWith({ bubbleShapePng: null });
    expect(updateSpaceInDb).toHaveBeenCalledWith('space-1', { bubbleShapePng: null });
    expect(updateSpacePane).not.toHaveBeenCalled();
  });

  it('saves custom bubble shape on default pane', async () => {
    const { ctx, onUpdateSpace } = makeContext(defaultPane);
    const path = '/assets/bubble-shapes/cloud.png';

    await savePaneBubbleShapeOverride(ctx, path);

    expect(onUpdateSpace).toHaveBeenCalledWith({ bubbleShapePng: path });
    expect(updateSpaceInDb).toHaveBeenCalledWith('space-1', { bubbleShapePng: path });
  });

  it('clears additional pane bubble shape with null', async () => {
    const { ctx, reloadPanesAndSyncActive } = makeContext(additionalPane);

    await savePaneBubbleShapeOverride(ctx, null);

    expect(updateSpacePane).toHaveBeenCalledWith('pane-2', { bubbleShapePng: null });
    expect(reloadPanesAndSyncActive).toHaveBeenCalled();
    expect(updateSpaceInDb).not.toHaveBeenCalled();
  });
});
