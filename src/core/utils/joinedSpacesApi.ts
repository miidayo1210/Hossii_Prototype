import { supabase, isSupabaseConfigured } from '../supabase';
import type { SpaceMembership } from '../types/spaceMembership';
import { fetchMySpaceMemberships } from './spaceMembershipsApi';

/**
 * Phase 2E: アカウントページ「参加しているスペース」一覧の表示用モデル。
 *
 * 本人の membership（RLS で本人分のみ）に、公開読み取り可能な spaces / communities の
 * 表示情報だけを結合したもの。role / status / auth_user_id / email 等の管理情報・PII は含めない。
 */
export type JoinedSpace = {
  membershipId: string;
  spaceId: string;
  spaceNickname: string | null;
  joinedAt: string;
  /** space が見つからない（削除済み等）場合は null → UI で fallback 表示 */
  spaceName: string | null;
  /** slug 未設定なら null → /s 導線を出さない */
  spaceUrl: string | null;
  communityName: string | null;
};

export type SpaceLookupRow = {
  id: string;
  name: string;
  space_url: string | null;
  community_id: string | null;
};

export type CommunityLookupRow = {
  id: string;
  name: string;
};

/**
 * membership（active のみ）と spaces / communities のルックアップ行から表示モデルを組み立てる純関数。
 * - space が見つからない membership も残し、spaceName/spaceUrl を null にして fallback 表示できるようにする。
 * - 返すのは表示に必要な最小情報のみ（role/status/UUID/PII を含めない）。
 */
export function buildJoinedSpaces(
  memberships: SpaceMembership[],
  spaceRows: SpaceLookupRow[],
  communityRows: CommunityLookupRow[],
): JoinedSpace[] {
  const spaceById = new Map<string, SpaceLookupRow>();
  for (const r of spaceRows) spaceById.set(r.id, r);
  const communityNameById = new Map<string, string>();
  for (const r of communityRows) communityNameById.set(r.id, r.name);

  return memberships
    .filter((m) => m.status === 'active')
    .map((m) => {
      const s = spaceById.get(m.spaceId);
      return {
        membershipId: m.id,
        spaceId: m.spaceId,
        spaceNickname: m.spaceNickname,
        joinedAt: m.joinedAt,
        spaceName: s?.name ?? null,
        spaceUrl: s?.space_url ?? null,
        communityName: s?.community_id
          ? communityNameById.get(s.community_id) ?? null
          : null,
      };
    });
}

/**
 * ログイン本人が参加しているスペースの一覧を取得する（Phase 2E）。
 *
 * - membership は本人分のみ（RLS）。ゲスト・未ログインは空配列。
 * - space / community 名は public read の spaces / communities から必要列だけ取得する
 *   （追加 migration 不要。返却列を最小に絞り PII を含めない）。
 * - membership 取得失敗は throw（UI 側で error 表示）。space/community 取得失敗のうち
 *   community は補助情報のため握りつぶし、一覧自体は表示する。
 */
export async function fetchMyJoinedSpaces(): Promise<JoinedSpace[]> {
  if (!isSupabaseConfigured) return [];

  const memberships = await fetchMySpaceMemberships();
  const active = memberships.filter((m) => m.status === 'active');
  if (active.length === 0) return [];

  const spaceIds = Array.from(new Set(active.map((m) => m.spaceId)));

  const { data: spaceData, error: spaceError } = await supabase
    .from('spaces')
    .select('id, name, space_url, community_id')
    .in('id', spaceIds);
  if (spaceError) {
    throw new Error(`[joinedSpacesApi] fetch spaces failed: ${spaceError.message}`);
  }
  const spaceRows = (spaceData ?? []) as SpaceLookupRow[];

  const communityIds = Array.from(
    new Set(spaceRows.map((r) => r.community_id).filter((id): id is string => !!id)),
  );

  let communityRows: CommunityLookupRow[] = [];
  if (communityIds.length > 0) {
    const { data: commData, error: commError } = await supabase
      .from('communities')
      .select('id, name')
      .in('id', communityIds);
    if (commError) {
      // community 名は補助情報。取得できなくても一覧は表示する。
      console.error('[joinedSpacesApi] fetch communities failed');
    } else {
      communityRows = (commData ?? []) as CommunityLookupRow[];
    }
  }

  return buildJoinedSpaces(active, spaceRows, communityRows);
}
