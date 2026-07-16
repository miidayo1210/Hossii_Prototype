import type { Space } from '../types/space';
import {
  resolvePersonalSpaceOwnerDisplay,
  type OwnerLookupRow,
} from './personalSpaceOwnerLabelsApi';

/** 検索クエリを正規化（前後空白除去・小文字化）。 */
export function normalizeAdminSpacesSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

/**
 * 個人スペースを所有者名・補助 email・スペース名で部分一致検索する。
 * 空クエリのときは全件を返す（順序は入力配列を維持）。
 */
export function filterPersonalSpacesBySearch(
  spaces: Space[],
  query: string,
  ownerLabels: Map<string, OwnerLookupRow>,
): Space[] {
  const normalized = normalizeAdminSpacesSearchQuery(query);
  if (!normalized) return spaces;

  return spaces.filter((space) => {
    const lookup = space.ownerUserId ? ownerLabels.get(space.ownerUserId) : undefined;
    const ownerDisplay = resolvePersonalSpaceOwnerDisplay(lookup);
    const fields = [
      ownerDisplay.displayName,
      ownerDisplay.supplementaryEmail ?? '',
      space.name,
    ];
    return fields.some((field) => field.toLowerCase().includes(normalized));
  });
}
