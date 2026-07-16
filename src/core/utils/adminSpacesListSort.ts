import type { Space } from '../types/space';
import {
  resolvePersonalSpaceOwnerDisplay,
  type OwnerLookupRow,
} from './personalSpaceOwnerLabelsApi';

export type SharedSpacesSortKey = 'current' | 'created_desc' | 'name_asc' | 'archived_last';

export type PersonalSpacesSortKey =
  | 'current'
  | 'owner_asc'
  | 'created_desc'
  | 'name_asc'
  | 'archived_last';

const JA_COLLATOR = new Intl.Collator('ja', { sensitivity: 'base' });

function compareCreatedAtAsc(a: Space, b: Space): number {
  return a.createdAt.getTime() - b.createdAt.getTime();
}

function compareCreatedAtDesc(a: Space, b: Space): number {
  return b.createdAt.getTime() - a.createdAt.getTime();
}

function compareNameAsc(a: Space, b: Space): number {
  return JA_COLLATOR.compare(a.name, b.name);
}

function compareArchivedLast(a: Space, b: Space): number {
  const aArchived = a.isArchived ? 1 : 0;
  const bArchived = b.isArchived ? 1 : 0;
  if (aArchived !== bArchived) return aArchived - bArchived;
  return 0;
}

/** 共有スペースの表示ソート（DB 順は変更しない）。 */
export function sortSharedSpaces(spaces: Space[], sortKey: SharedSpacesSortKey): Space[] {
  if (sortKey === 'current') return [...spaces];

  const sorted = [...spaces];
  sorted.sort((a, b) => {
    if (sortKey === 'archived_last') {
      const archivedCmp = compareArchivedLast(a, b);
      if (archivedCmp !== 0) return archivedCmp;
      return compareCreatedAtAsc(a, b);
    }
    if (sortKey === 'created_desc') return compareCreatedAtDesc(a, b);
    if (sortKey === 'name_asc') return compareNameAsc(a, b);
    return 0;
  });
  return sorted;
}

function getOwnerSortName(space: Space, ownerLabels: Map<string, OwnerLookupRow>): string {
  const lookup = space.ownerUserId ? ownerLabels.get(space.ownerUserId) : undefined;
  return resolvePersonalSpaceOwnerDisplay(lookup).displayName;
}

/** 個人スペースの表示ソート（DB 順は変更しない）。 */
export function sortPersonalSpaces(
  spaces: Space[],
  sortKey: PersonalSpacesSortKey,
  ownerLabels: Map<string, OwnerLookupRow>,
): Space[] {
  if (sortKey === 'current') return [...spaces];

  const sorted = [...spaces];
  sorted.sort((a, b) => {
    if (sortKey === 'archived_last') {
      const archivedCmp = compareArchivedLast(a, b);
      if (archivedCmp !== 0) return archivedCmp;
      return JA_COLLATOR.compare(getOwnerSortName(a, ownerLabels), getOwnerSortName(b, ownerLabels));
    }
    if (sortKey === 'owner_asc') {
      return JA_COLLATOR.compare(getOwnerSortName(a, ownerLabels), getOwnerSortName(b, ownerLabels));
    }
    if (sortKey === 'created_desc') return compareCreatedAtDesc(a, b);
    if (sortKey === 'name_asc') return compareNameAsc(a, b);
    return 0;
  });
  return sorted;
}
