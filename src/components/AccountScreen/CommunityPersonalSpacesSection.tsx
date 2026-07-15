import { useState, useEffect, useCallback, useRef } from 'react';
import { Archive, Lock, Plus } from 'lucide-react';
import { useAuth } from '../../core/contexts/useAuth';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import type { CommunityMembershipRole } from '../../core/types/communityMembership';
import {
  fetchAccountCommunityPersonalSpaces,
  ensureMyPersonalSpace,
  fetchPersonalSpaceForStore,
  type AccountCommunityPersonalSpace,
} from '../../core/utils/personalSpacesApi';
import styles from './CommunityPersonalSpacesSection.module.css';

type Status = 'idle' | 'loading' | 'error' | 'ready';

function membershipRoleLabel(role: CommunityMembershipRole): string {
  return role === 'admin' ? '管理者' : 'メンバー';
}

/**
 * アカウント画面: 所属コミュニティごとのマイスペース有無と作成導線。
 *
 * - active な community_memberships のコミュニティのみ表示。
 * - 作成は ensure_my_personal_space(community_id) を明示指定。画面遷移なし。
 * - 作成後は当該コミュニティ行のみ即時更新し、store へ personal space を追加。
 */
export const CommunityPersonalSpacesSection = () => {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid ?? null;
  const [status, setStatus] = useState<Status>('idle');
  const [items, setItems] = useState<AccountCommunityPersonalSpace[]>([]);
  const reqIdRef = useRef(0);

  const load = useCallback(async () => {
    const reqId = ++reqIdRef.current;
    setStatus('loading');
    try {
      const rows = await fetchAccountCommunityPersonalSpaces();
      if (reqId !== reqIdRef.current) return;
      setItems(rows);
      setStatus('ready');
    } catch {
      if (reqId !== reqIdRef.current) return;
      console.error('[CommunityPersonalSpacesSection] failed to load');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (!uid) {
      reqIdRef.current += 1;
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [uid, load]);

  const handleCreated = useCallback(
    (communityId: string, spaceId: string, spaceUrl: string | null) => {
      setItems((prev) =>
        prev.map((it) =>
          it.communityId === communityId
            ? {
                ...it,
                personalSpaceId: spaceId,
                personalSpaceUrl: spaceUrl,
                personalSpaceStatus: 'active',
              }
            : it,
        ),
      );
    },
    [],
  );

  if (!currentUser) {
    return (
      <p className={styles.note}>
        ログインして、コミュニティに参加すると、マイスペースをここから作成できます。
      </p>
    );
  }

  if (status === 'idle' || status === 'loading') {
    return <p className={styles.note}>読み込み中…</p>;
  }

  if (status === 'error') {
    return (
      <div className={styles.note}>
        <p>マイスペース情報の取得に失敗しました。時間をおいて再度お試しください。</p>
        <button type="button" className={styles.retryBtn} onClick={() => void load()}>
          再読み込み
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className={styles.note}>
        参加中のコミュニティがありません。コミュニティに参加すると、そのコミュニティ内に
        あなた専用のマイスペースを作成できます。
      </p>
    );
  }

  return (
    <>
      <div className={styles.privacyNote}>
        <Lock size={13} />
        <span>
          マイスペースは、あなたとそのコミュニティの管理者が閲覧できます。他のメンバーには公開されません。
        </span>
      </div>
      <ul className={styles.list}>
        {items.map((it) => (
          <CommunityPersonalSpaceItem key={it.communityId} item={it} onCreated={handleCreated} />
        ))}
      </ul>
    </>
  );
};

type ItemProps = {
  item: AccountCommunityPersonalSpace;
  onCreated: (communityId: string, spaceId: string, spaceUrl: string | null) => void;
};

const CommunityPersonalSpaceItem = ({ item, onCreated }: ItemProps) => {
  const { addSpaceLocal } = useHossiiStore();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const created = !!item.personalSpaceId;
  const archived = item.personalSpaceStatus === 'archived';

  const create = async () => {
    if (creating || created) return;
    setCreating(true);
    setError(null);
    const res = await ensureMyPersonalSpace(item.communityId);
    if (!res.ok) {
      setCreating(false);
      setError('マイスペースの作成に失敗しました。時間をおいてお試しください。');
      return;
    }
    const fetched = await fetchPersonalSpaceForStore(res.spaceUrl);
    if (fetched) {
      addSpaceLocal(fetched);
    }
    setCreating(false);
    onCreated(item.communityId, res.spaceId, res.spaceUrl);
  };

  return (
    <li className={styles.item}>
      <div className={styles.itemHeader}>
        <span className={styles.communityName}>{item.communityName}</span>
        <span className={styles.roleBadge}>{membershipRoleLabel(item.membershipRole)}</span>
      </div>

      <div className={styles.itemBody}>
        {created ? (
          <>
            <div className={styles.statusRow}>
              <span className={styles.statusLabel}>マイスペースあり</span>
              {archived && (
                <span className={styles.archivedBadge}>
                  <Archive size={12} />
                  アーカイブ
                </span>
              )}
            </div>
            <span className={styles.subtle}>
              共有スペースの「マイスペース」タブから利用できます
            </span>
          </>
        ) : (
          <>
            <span className={styles.statusLabel}>マイスペース未作成</span>
            <span className={styles.subtle}>
              このコミュニティ内に、あなた専用のスペースを1つ作成します。
            </span>
          </>
        )}
        {error && <span className={styles.error}>{error}</span>}
      </div>

      {!created && (
        <button
          type="button"
          className={styles.createBtn}
          disabled={creating}
          onClick={() => void create()}
        >
          <Plus size={14} />
          {creating ? '作成中…' : 'マイスペースを作る'}
        </button>
      )}
    </li>
  );
};
