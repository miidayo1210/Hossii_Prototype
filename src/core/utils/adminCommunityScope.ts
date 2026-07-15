import type { CommunityStatus } from './communitiesApi';

/** 管理者が所有するコミュニティの参照（#spaces スコープ解決用） */
export type ManagedCommunityRef = {
  id: string;
  status: CommunityStatus;
};

export type ResolveSpacesCommunityIdInput = {
  /** スーパー管理者の明示選択（CommunitiesScreen 等） */
  overrideCommunityId: string | null | undefined;
  /** localStorage / SelectedCommunity の選択 */
  selectedCommunityId: string | null | undefined;
  /** Auth 解決済みのフォールバック */
  fallbackCommunityId: string | null | undefined;
  managedCommunities: ManagedCommunityRef[];
  isSuperAdmin: boolean;
};

function isApprovedManaged(
  id: string,
  managedCommunities: ManagedCommunityRef[],
): boolean {
  const row = managedCommunities.find((c) => c.id === id);
  return row?.status === 'approved';
}

function firstApprovedManagedId(managedCommunities: ManagedCommunityRef[]): string | null {
  const approved = managedCommunities.filter((c) => c.status === 'approved');
  return approved[0]?.id ?? null;
}

/**
 * #spaces 用の effective community_id を決める。
 *
 * - スーパー管理者: override のみ（未選択なら null）
 * - コミュニティ管理者: 候補を順に検証し、管理権限があり approved のものを採用
 * - pending は自動選択しない（候補にも fallback にも使わない）
 */
export function resolveSpacesCommunityId(input: ResolveSpacesCommunityIdInput): string | null {
  const {
    overrideCommunityId,
    selectedCommunityId,
    fallbackCommunityId,
    managedCommunities,
    isSuperAdmin,
  } = input;

  if (isSuperAdmin) {
    return overrideCommunityId ?? null;
  }

  if (managedCommunities.length === 0) {
    return fallbackCommunityId ?? null;
  }

  const managedIds = new Set(managedCommunities.map((c) => c.id));
  const candidates = [
    overrideCommunityId,
    selectedCommunityId,
    fallbackCommunityId,
  ];

  for (const id of candidates) {
    if (!id || !managedIds.has(id)) continue;
    if (!isApprovedManaged(id, managedCommunities)) continue;
    return id;
  }

  return firstApprovedManagedId(managedCommunities);
}
