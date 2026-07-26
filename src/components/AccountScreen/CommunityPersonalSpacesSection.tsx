import { useState, useEffect, useCallback, useRef } from 'react';
import { Archive, ExternalLink, Lock, Plus } from 'lucide-react';
import { useAuth } from '../../core/contexts/useAuth';
import { useSelectedCommunity } from '../../core/contexts/useSelectedCommunity';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import type { CommunityMembershipRole } from '../../core/types/communityMembership';
import {
  MY_SPACE_ARCHIVED_NOTE,
  MY_SPACE_INTRO,
  MY_SPACE_PER_COMMUNITY,
  MY_SPACE_PRIVACY,
  MY_SPACE_UNCREATED_HINT,
} from '../../core/utils/mySpaceCopy';
import {
  fetchAccountCommunityPersonalSpaces,
  ensureMyPersonalSpace,
  fetchPersonalSpaceForStore,
  type AccountCommunityPersonalSpace,
} from '../../core/utils/personalSpacesApi';
import type { IssuedParticipantScopeOk } from '../../core/utils/participantAccountScopeApi';
import { resolveAccountAffiliationSource } from '../../core/utils/resolveAccountAffiliationSource';
import { buildCanonicalSpaceScreenHref } from '../../core/utils/spaceScreenRoute';
import { SpaceArchiveBadge } from '../Spaces/SpaceArchiveBadge';
import styles from './CommunityPersonalSpacesSection.module.css';

type Status = 'idle' | 'loading' | 'error' | 'ready';

function membershipRoleLabel(role: CommunityMembershipRole): string {
  return role === 'admin' ? '管理者' : 'メンバー';
}

/**
 * アカウント画面: 所属コミュニティごとのマイスペース有無と作成導線。
 *
 * - 通常アカウント: active な community_memberships のコミュニティのみ表示。
 * - 参加IDアカウント: SelectedCommunity の発行元 scope を再利用し、発行元スペース 1 件のみ。
 *   list_my_community_personal_spaces / membership 一覧へ fallback しない。
 */
export const CommunityPersonalSpacesSection = () => {
  const { currentUser } = useAuth();
  const {
    loading: communityLoading,
    issuedParticipantScope,
    refreshMemberships,
  } = useSelectedCommunity();
  const uid = currentUser?.uid ?? null;
  const isIssuedParticipant =
    resolveAccountAffiliationSource(currentUser?.isIssuedParticipant) === 'issued_participant_scope';
  const [status, setStatus] = useState<Status>('idle');
  const [items, setItems] = useState<AccountCommunityPersonalSpace[]>([]);
  const [issuedSpace, setIssuedSpace] = useState<IssuedParticipantScopeOk | null>(null);
  const reqIdRef = useRef(0);

  const load = useCallback(async () => {
    const reqId = ++reqIdRef.current;
    setStatus('loading');
    try {
      // 参加ID: Context 取得済み scope のみ。membership 系 API は呼ばない。
      if (isIssuedParticipant) {
        if (communityLoading && !issuedParticipantScope) {
          if (reqId !== reqIdRef.current) return;
          setIssuedSpace(null);
          setItems([]);
          setStatus('loading');
          return;
        }
        if (!issuedParticipantScope || !issuedParticipantScope.ok) {
          if (reqId !== reqIdRef.current) return;
          if (issuedParticipantScope && !issuedParticipantScope.ok) {
            console.error(
              '[CommunityPersonalSpacesSection] issued participant scope failed:',
              issuedParticipantScope.reason,
            );
          }
          setIssuedSpace(null);
          setItems([]);
          setStatus('error');
          return;
        }
        if (reqId !== reqIdRef.current) return;
        setIssuedSpace(issuedParticipantScope);
        setItems([]);
        setStatus('ready');
        return;
      }

      setIssuedSpace(null);
      const rows = await fetchAccountCommunityPersonalSpaces();
      if (reqId !== reqIdRef.current) return;
      setItems(rows);
      setStatus('ready');
    } catch {
      if (reqId !== reqIdRef.current) return;
      console.error('[CommunityPersonalSpacesSection] failed to load');
      setIssuedSpace(null);
      setItems([]);
      setStatus('error');
    }
  }, [isIssuedParticipant, communityLoading, issuedParticipantScope]);

  useEffect(() => {
    // 未ログインでは取得しない（render 側で currentUser を見て案内を出す）。
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
  }, [uid, isIssuedParticipant, load]);

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
                personalSpaceIsArchived: false,
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
        <button
          type="button"
          className={styles.retryBtn}
          onClick={() => {
            if (isIssuedParticipant) void refreshMemberships();
            else void load();
          }}
        >
          再読み込み
        </button>
      </div>
    );
  }

  if (isIssuedParticipant) {
    if (!issuedSpace) {
      return (
        <p className={styles.note}>
          発行元スペースを表示できませんでした。時間をおいて再度お試しください。
        </p>
      );
    }
    return (
      <>
        <p className={styles.introNote}>参加IDで発行されたスペースです。</p>
        <ul className={styles.list} data-testid="issued-participant-personal-spaces">
          <IssuedParticipantSpaceItem scope={issuedSpace} />
        </ul>
      </>
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
      <p className={styles.introNote}>{MY_SPACE_INTRO}</p>
      <p className={styles.introSubtle}>{MY_SPACE_PER_COMMUNITY}</p>
      <div className={styles.privacyNote}>
        <Lock size={13} />
        <span>{MY_SPACE_PRIVACY}</span>
      </div>
      <ul className={styles.list}>
        {items.map((it) => (
          <CommunityPersonalSpaceItem key={it.communityId} item={it} onCreated={handleCreated} />
        ))}
      </ul>
    </>
  );
};

const IssuedParticipantSpaceItem = ({ scope }: { scope: IssuedParticipantScopeOk }) => {
  const openHref =
    scope.spaceUrl && scope.communitySlug
      ? buildCanonicalSpaceScreenHref({
          communitySlug: scope.communitySlug,
          spaceUrl: scope.spaceUrl,
        })
      : scope.spaceUrl
        ? `/s/${scope.spaceUrl}#screen`
        : null;

  return (
    <li className={styles.issuedItem} data-testid="issued-participant-space-row">
      <div className={styles.itemBody}>
        <span className={styles.spaceNameRow}>
          <span className={styles.spaceName}>{scope.spaceName ?? '不明なスペース'}</span>
          {scope.isArchived && <SpaceArchiveBadge />}
        </span>
        <span className={styles.communityName}>{scope.communityName}</span>
      </div>
      {openHref ? (
        <a className={styles.openLink} href={openHref}>
          <ExternalLink size={14} />
          開く
        </a>
      ) : (
        <span className={styles.openDisabled} title="このスペースは現在開けません">
          開けません
        </span>
      )}
    </li>
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
  const archived = item.personalSpaceIsArchived;

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
            {archived ? (
              <span className={styles.subtle}>{MY_SPACE_ARCHIVED_NOTE}</span>
            ) : (
              <span className={styles.subtle}>
                共有スペースの「マイスペース」タブから利用できます
              </span>
            )}
          </>
        ) : (
          <>
            <span className={styles.statusLabel}>マイスペース未作成</span>
            <span className={styles.subtle}>
              このコミュニティに、あなた専用のマイスペースを1つ作れます。
            </span>
            <span className={styles.subtle}>{MY_SPACE_UNCREATED_HINT}</span>
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
