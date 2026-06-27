import type { SpacePane } from '../types/spacePane';

const STORAGE_PREFIX = 'hossii_demo_space_panes:';

type SerializedSpacePane = Omit<SpacePane, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

function serialize(pane: SpacePane): SerializedSpacePane {
  return {
    ...pane,
    createdAt: pane.createdAt.toISOString(),
    updatedAt: pane.updatedAt.toISOString(),
  };
}

function deserialize(raw: SerializedSpacePane): SpacePane {
  return {
    ...raw,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
  };
}

function sortPanes(panes: SpacePane[]): SpacePane[] {
  return [...panes].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
  );
}

export function loadDemoSpacePanesForSpace(spaceId: string): SpacePane[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${spaceId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SerializedSpacePane[];
    if (!Array.isArray(parsed)) return [];
    return sortPanes(parsed.map(deserialize));
  } catch {
    return [];
  }
}

export function appendDemoSpacePane(pane: SpacePane): void {
  const existing = loadDemoSpacePanesForSpace(pane.spaceId);
  const next = [...existing.filter((p) => p.id !== pane.id), pane];
  localStorage.setItem(
    `${STORAGE_PREFIX}${pane.spaceId}`,
    JSON.stringify(next.map(serialize)),
  );
}
