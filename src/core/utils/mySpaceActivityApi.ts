import { supabase, isSupabaseConfigured } from '../supabase';
import type { EmotionKey } from '../types';
import type { MyHossiiActivity, MyHossiiRecentPost } from './myHossiiActivity';

/**
 * My Hossii: ログイン本人の「スペース全体での正確な個人ログ」を DB から取得する。
 *
 * クライアントのロード済みデータ（materializeHossiisArray）はページング未取得分を
 * 集計できないため、件数・直近ログが不正確になり得る。本 API は SECURITY DEFINER RPC
 * `get_my_space_activity` を通じて、DB/RLS 側で正確な件数と直近ログ（最大 3 件）を返す。
 *
 * 本人性の正本は auth.uid()（RPC 内 hossii_authorships）で、他人・ゲスト投稿は含まれない。
 */

const EMOTION_KEYS: EmotionKey[] = [
  'wow',
  'empathy',
  'inspire',
  'think',
  'laugh',
  'joy',
  'moved',
  'fun',
];

function parseEmotion(raw: unknown): EmotionKey | undefined {
  return typeof raw === 'string' && (EMOTION_KEYS as string[]).includes(raw)
    ? (raw as EmotionKey)
    : undefined;
}

function parseRecentPost(raw: unknown): MyHossiiRecentPost | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string') return null;
  const createdAt = typeof r.created_at === 'string' ? new Date(r.created_at) : null;
  if (!createdAt || Number.isNaN(createdAt.getTime())) return null;
  return {
    id: r.id,
    message: typeof r.message === 'string' ? r.message : '',
    createdAt,
    emotion: parseEmotion(r.emotion),
  };
}

/**
 * RPC の生レスポンス（jsonb）を MyHossiiActivity へ変換する純粋関数。
 * 想定外の形状なら null を返し、呼び出し側は暫定表示へ安全に fallback できる。
 */
export function mapMySpaceActivity(raw: unknown): MyHossiiActivity | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  const postCountRaw = obj.post_count;
  const postCount =
    typeof postCountRaw === 'number' && Number.isFinite(postCountRaw)
      ? Math.max(0, Math.trunc(postCountRaw))
      : null;
  if (postCount === null) return null;

  const recentRaw = Array.isArray(obj.recent) ? obj.recent : [];
  const recentPosts = recentRaw
    .map(parseRecentPost)
    .filter((p): p is MyHossiiRecentPost => p !== null)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return {
    postCount,
    recentPosts,
    lastActivityAt: recentPosts[0]?.createdAt ?? null,
  };
}

/**
 * ログイン本人のスペース全体の個人ログを取得する。
 * - 未設定 / 未ログイン / RPC 失敗時は null（呼び出し側は暫定表示を維持）。
 * - 成功時は DB 正本の件数・直近ログを返す（最終表示の正本）。
 */
export async function fetchMySpaceActivity(spaceId: string): Promise<MyHossiiActivity | null> {
  if (!isSupabaseConfigured || !spaceId) return null;

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return null;

  const { data, error } = await supabase.rpc('get_my_space_activity', {
    p_space_id: spaceId,
  });
  if (error) {
    console.warn('[mySpaceActivityApi] get_my_space_activity failed:', error.message);
    return null;
  }

  return mapMySpaceActivity(data);
}
