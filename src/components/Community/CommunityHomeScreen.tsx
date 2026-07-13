import { useCallback, useEffect, useState } from 'react';
import { Users, Mail, Bell } from 'lucide-react';
import { useRouter } from '../../core/hooks/useRouter';
import { useSelectedCommunity } from '../../core/contexts/useSelectedCommunity';
import { TopRightMenu } from '../Navigation/TopRightMenu';
import { CommunitySwitcher } from './CommunitySwitcher';
import { CommunityMembersAdmin } from './CommunityMembersAdmin';
import { CommunityInviteAdmin } from './CommunityInviteAdmin';
import {
  fetchCommunityHome,
  fetchCommunitySharedSpaces,
  type CommunityHomeData,
  type CommunitySharedSpace,
} from '../../core/utils/communityHomeApi';
import { updateMyCommunityNickname } from '../../core/utils/communityInvitationsApi';
import { ensureMyPersonalSpace } from '../../core/utils/personalSpacesApi';
import styles from './CommunityHomeScreen.module.css';

type Props = {
  communityId?: string;
};

const statusBanner: Record<string, string> = {
  suspended: 'このコミュニティでの利用は一時停止されています。スペースや個人スペースには入れません。',
  removed: 'このコミュニティからの所属は解除されています。',
  invited: '招待を受け取っています。承認後に利用できます。',
};

export const CommunityHomeScreen = ({ communityId: propCommunityId }: Props) => {
  const { navigate } = useRouter();
  const { selectedCommunityId, refreshMemberships } = useSelectedCommunity();
  const communityId = propCommunityId ?? selectedCommunityId;
  const [home, setHome] = useState<CommunityHomeData | null>(null);
  const [spaces, setSpaces] = useState<CommunitySharedSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nicknameInput, setNicknameInput] = useState('');
  const [savingNick, setSavingNick] = useState(false);
  const [adminTab, setAdminTab] = useState<'members' | 'invites'>('members');

  const load = useCallback(async () => {
    if (!communityId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [h, s] = await Promise.all([
        fetchCommunityHome(communityId),
        fetchCommunitySharedSpaces(communityId),
      ]);
      setHome(h);
      setSpaces(s);
      setNicknameInput(h?.myCommunityNickname ?? '');
    } catch {
      setError('コミュニティ情報の取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSaveNickname = async () => {
    if (!communityId || savingNick) return;
    setSavingNick(true);
    const res = await updateMyCommunityNickname(communityId, nicknameInput);
    setSavingNick(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    await refreshMemberships();
    await load();
  };

  const handleOpenPersonal = async () => {
    if (!communityId || !home?.canViewPrivate) return;
    try {
      const res = await ensureMyPersonalSpace(communityId);
      if (res.ok && res.spaceUrl && home.communitySlug) {
        window.location.href = `/c/${home.communitySlug}/s/${res.spaceUrl}#screen`;
      }
    } catch {
      setError('個人スペースを開けませんでした。');
    }
  };

  const openSpace = (space: CommunitySharedSpace) => {
    if (!space.canEnter || !home?.communitySlug) return;
    window.location.href = `/c/${home.communitySlug}/s/${space.spaceUrl}#screen`;
  };

  if (!communityId) {
    return (
      <div className={styles.page}>
        <TopRightMenu />
        <div className={styles.card}>
          <CommunitySwitcher onNavigateHome={(id) => navigate('community', id)} />
          <p className={styles.muted}>コミュニティを選択してください。</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <TopRightMenu />
      <header className={styles.header}>
        <h1 className={styles.title}>コミュニティ HOME</h1>
        <CommunitySwitcher onNavigateHome={(id) => navigate('community', id)} />
      </header>

      {loading && <p className={styles.muted}>読み込み中…</p>}
      {error && <p className={styles.error}>{error}</p>}

      {home && (
        <main className={styles.main}>
          {home.myStatus !== 'active' && (
            <div className={styles.banner}>{statusBanner[home.myStatus]}</div>
          )}

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>{home.communityName}</h2>
            {home.communityDescription && (
              <p className={styles.description}>{home.communityDescription}</p>
            )}
            <dl className={styles.dl}>
              <dt>あなたの役割</dt>
              <dd>{home.myRole === 'admin' ? '管理者' : 'メンバー'}</dd>
              <dt>ステータス</dt>
              <dd>{home.myStatus}</dd>
            </dl>
          </section>

          {home.canViewPrivate && (
            <section className={styles.card}>
              <h3 className={styles.sectionTitle}>コミュニティでの表示名</h3>
              <div className={styles.nickRow}>
                <input
                  className={styles.input}
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  placeholder="このコミュニティでのニックネーム"
                  maxLength={50}
                />
                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={savingNick}
                  onClick={() => void handleSaveNickname()}
                >
                  保存
                </button>
              </div>
            </section>
          )}

          {home.canViewPrivate && (
            <section className={styles.card}>
              <h3 className={styles.sectionTitle}>共有スペース</h3>
              {spaces.length === 0 ? (
                <p className={styles.muted}>共有スペースがありません。</p>
              ) : (
                <ul className={styles.spaceList}>
                  {spaces.map((s) => (
                    <li key={s.spaceId}>
                      <button
                        type="button"
                        className={styles.spaceBtn}
                        disabled={!s.canEnter}
                        onClick={() => openSpace(s)}
                      >
                        <span>{s.spaceName}</span>
                        <span className={styles.badge}>
                          {s.accessMode === 'invite_only' ? '招待制' : '公開'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {home.canViewPrivate && (
            <section className={styles.card}>
              <h3 className={styles.sectionTitle}>個人スペース</h3>
              {home.personalSpaceUrl ? (
                <button type="button" className={styles.primaryBtn} onClick={handleOpenPersonal}>
                  個人スペースを開く
                </button>
              ) : (
                <button type="button" className={styles.primaryBtn} onClick={handleOpenPersonal}>
                  個人スペースを作成して開く
                </button>
              )}
            </section>
          )}

          <section className={`${styles.card} ${styles.placeholder}`}>
            <Bell size={18} aria-hidden />
            <div>
              <h3 className={styles.sectionTitle}>お知らせ</h3>
              <p className={styles.muted}>将来、コミュニティからのお知らせがここに表示されます。</p>
            </div>
          </section>

          {home.isCommunityAdmin && (
            <section className={styles.card}>
              <h3 className={styles.sectionTitle}>メンバー管理</h3>
              <div className={styles.tabRow}>
                <button
                  type="button"
                  className={adminTab === 'members' ? styles.tabActive : styles.tab}
                  onClick={() => setAdminTab('members')}
                >
                  <Users size={16} /> メンバー
                </button>
                <button
                  type="button"
                  className={adminTab === 'invites' ? styles.tabActive : styles.tab}
                  onClick={() => setAdminTab('invites')}
                >
                  <Mail size={16} /> 招待
                </button>
              </div>
              {adminTab === 'members' ? (
                <CommunityMembersAdmin communityId={communityId} />
              ) : (
                <CommunityInviteAdmin communityId={communityId} />
              )}
            </section>
          )}
        </main>
      )}
    </div>
  );
};
