import { useState, useEffect, useCallback, useRef } from 'react';
import { Check, Lock, Plus } from 'lucide-react';
import { useAuth } from '../../core/contexts/useAuth';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import {
  fetchMyCommunityPersonalSpaces,
  ensureMyPersonalSpace,
  fetchPersonalSpaceForStore,
  type CommunityPersonalSpace,
} from '../../core/utils/personalSpacesApi';
import styles from './CommunityPersonalSpacesSection.module.css';

type Status = 'idle' | 'loading' | 'error' | 'ready';

/**
 * Phase 3: コミュニティ内個人スペースの作成導線。
 *
 * - 個人スペースは AccountScreen / MyLogs / My Hossii（個人領域）とは別物で、
 *   特定コミュニティの目的に沿った「その人専用の実際のスペース」。
 * - 本人が active member のコミュニティごとに、未作成なら「作る」、作成済みなら状態表示。
 * - 作成後はアカウント画面に留まり、共有スペースの「マイスペース」タブから開く。
 * - 未ログイン（ゲスト）は案内を表示し、何も取得しない。
 */
export const CommunityPersonalSpacesSection = () => {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid ?? null;
  const [status, setStatus] = useState<Status>('idle');
  const [items, setItems] = useState<CommunityPersonalSpace[]>([]);
  const reqIdRef = useRef(0);

  const load = useCallback(async () => {
    const reqId = ++reqIdRef.current;
    setStatus('loading');
    try {
      const rows = await fetchMyCommunityPersonalSpaces();
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
            ? { ...it, personalSpaceId: spaceId, personalSpaceUrl: spaceUrl, personalSpaceStatus: 'active' }
            : it,
        ),
      );
    },
    [],
  );

  if (!currentUser) {
    return (
      <p className={styles.note}>
        ログインして、コミュニティに参加すると、個人スペースをここから作成できます。
      </p>
    );
  }

  if (status === 'idle' || status === 'loading') {
    return <p className={styles.note}>読み込み中…</p>;
  }

  if (status === 'error') {
    return (
      <div className={styles.note}>
        <p>個人スペース情報の取得に失敗しました。時間をおいて再度お試しください。</p>
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
        あなた専用の個人スペースを作成できます。
      </p>
    );
  }

  return (
    <>
      <div className={styles.privacyNote}>
        <Lock size={13} />
        <span>
          個人スペースは、あなたとそのコミュニティの管理者が閲覧できます。他のメンバーには公開されません。
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
  item: CommunityPersonalSpace;
  onCreated: (communityId: string, spaceId: string, spaceUrl: string | null) => void;
};

const CommunityPersonalSpaceItem = ({ item, onCreated }: ItemProps) => {
  const { addSpaceLocal } = useHossiiStore();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const created = !!item.personalSpaceId;

  const create = async () => {
    if (creating) return;
    setCreating(true);
    setError(null);
    const res = await ensureMyPersonalSpace(item.communityId);
    if (!res.ok) {
      setCreating(false);
      setError('個人スペースの作成に失敗しました。時間をおいてお試しください。');
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
      <div className={styles.itemMain}>
        <span className={styles.communityName}>{item.communityName}</span>
        {created ? (
          <span className={styles.subtle}>
            マイスペースがあります。共有スペースの「マイスペース」タブから開けます。
          </span>
        ) : (
          <span className={styles.subtle}>
            このコミュニティ内に、あなた専用のスペース（初期タブと背景つき）を1つ作成します。
            投稿や記録はコピーされず、空の状態から始まります。
          </span>
        )}
        {error && <span className={styles.error}>{error}</span>}
      </div>

      {created ? (
        <span className={styles.createdBadge}>
          <Check size={14} />
          作成済み
        </span>
      ) : (
        <button
          type="button"
          className={styles.createBtn}
          disabled={creating}
          onClick={() => void create()}
        >
          <Plus size={14} />
          {creating ? '作成中…' : '個人スペースを作る'}
        </button>
      )}
    </li>
  );
};
