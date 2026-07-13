import { useMemo, useState } from 'react';
import { LogOut, User } from 'lucide-react';
import { nicknameInputAntiAutofillProps } from '../../core/utils/nicknameInputProps';
import { TopRightMenu } from '../Navigation/TopRightMenu';
import { useAuth } from '../../core/contexts/useAuth';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { ACCOUNT_AUTH_COMING_SOON } from '../../core/config/features';
import { MyHossiiSettingsSection } from './MyHossiiSettingsSection';
import { JoinedSpacesSection } from './JoinedSpacesSection';
import { CommunityPersonalSpacesSection } from './CommunityPersonalSpacesSection';
import { CommunitySwitcher } from '../Community/CommunitySwitcher';
import { useRouter } from '../../core/hooks/useRouter';
import { useSelectedCommunity } from '../../core/contexts/useSelectedCommunity';
import { resolveAccountIdentity } from '../../core/utils/resolveAccountIdentity';
import styles from './AccountScreen.module.css';

type Props = {
  onLoginRequested?: () => void;
  onSignUpRequested?: () => void;
};

export const AccountScreen = ({ onLoginRequested, onSignUpRequested }: Props) => {
  const { currentUser, logout } = useAuth();
  const { navigate } = useRouter();
  const { selectedMembership } = useSelectedCommunity();
  const { state, setDefaultNickname, setSpaceNickname, getActiveSpace } = useHossiiStore();
  const { profile, spaceNicknames, activeSpaceId } = state;
  const activeSpace = getActiveSpace();

  const identity = useMemo(
    () =>
      resolveAccountIdentity({
        currentUser,
        spaceNickname: spaceNicknames[activeSpaceId] ?? null,
        communityNickname: selectedMembership?.communityNickname ?? null,
        profileNickname: profile?.defaultNickname ?? null,
      }),
    [
      currentUser,
      spaceNicknames,
      activeSpaceId,
      selectedMembership?.communityNickname,
      profile?.defaultNickname,
    ],
  );

  const [defaultNicknameInput, setDefaultNicknameInput] = useState(
    profile?.defaultNickname || ''
  );
  const [spaceNicknameInput, setSpaceNicknameInput] = useState(
    spaceNicknames[activeSpaceId] || ''
  );
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [savedDefault, setSavedDefault] = useState(false);
  const [savedSpace, setSavedSpace] = useState(false);
  const [nicknameSaveRevision, setNicknameSaveRevision] = useState(0);

  const handleSaveDefaultNickname = () => {
    const trimmed = defaultNicknameInput.trim();
    if (!trimmed) return;
    setDefaultNickname(trimmed);
    setSavedDefault(true);
    setTimeout(() => setSavedDefault(false), 2000);
  };

  const handleSaveSpaceNickname = () => {
    const trimmed = spaceNicknameInput.trim();
    if (!trimmed) return;
    setSpaceNickname(activeSpaceId, trimmed);
    setNicknameSaveRevision((revision) => revision + 1);
    setSavedSpace(true);
    setTimeout(() => setSavedSpace(false), 2000);
  };

  const guestSignUpLocked = !currentUser && ACCOUNT_AUTH_COMING_SOON;

  const handleLogout = async () => {
    if (isLoggingOut) return;
    const confirmed = window.confirm('ログアウトしてもよろしいですか？');
    if (!confirmed) return;
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('screen');
    } catch (error) {
      console.error('Logout error:', error);
      alert('ログアウトに失敗しました');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className={styles.container}>
      <TopRightMenu />

      <header className={styles.header}>
        <h1 className={styles.title}>アカウント</h1>
      </header>

      <main className={styles.content}>

        <section className={styles.identityBanner} aria-live="polite">
          <p className={styles.identityGreeting}>{identity.greeting}</p>
          <p className={styles.identityStatus}>{identity.statusLabel}</p>
        </section>

        {/* アカウント情報 */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>アカウント情報</h2>

          {currentUser ? (
            <>
              <div className={styles.userInfo}>
                <div className={styles.userAvatar}>
                  <User size={28} />
                </div>
                <div className={styles.userDetails}>
                  <div className={styles.userName}>{identity.displayName}</div>
                </div>
              </div>
              <button
                className={styles.logoutButton}
                onClick={handleLogout}
                disabled={isLoggingOut}
              >
                <LogOut size={16} />
                <span>{isLoggingOut ? 'ログアウト中...' : 'ログアウト'}</span>
              </button>
            </>
          ) : (
            <div className={styles.guestInfo}>
              <div className={styles.guestLabel}>ゲストとして参加中</div>
              <p className={styles.guestDesc}>
                アカウントを作成すると、複数の端末で同じ情報を使えます。
              </p>
              {guestSignUpLocked && (
                <p className={styles.comingSoonHint} role="status">
                  新規会員登録は Coming soon です。管理者から発行された参加 ID がある場合はログインできます。
                </p>
              )}
              <div className={styles.guestActions}>
                <button
                  type="button"
                  className={styles.loginButton}
                  onClick={onLoginRequested}
                >
                  アカウントでログイン
                </button>
                <button
                  type="button"
                  className={`${styles.signUpButton} ${guestSignUpLocked ? styles.guestAuthLocked : ''}`}
                  disabled={guestSignUpLocked}
                  onClick={onSignUpRequested}
                >
                  新規会員登録
                </button>
              </div>
            </div>
          )}
        </section>

        {currentUser && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>所属コミュニティ</h2>
            <p className={styles.sectionDesc}>
              複数のコミュニティに所属している場合は、ここで切り替えられます。
            </p>
            <CommunitySwitcher onNavigateHome={(id) => navigate('community', id)} />
          </section>
        )}

        {/* 参加しているスペース */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>参加しているスペース</h2>
          <p className={styles.sectionDesc}>
            あなたがログインして参加したスペースの一覧です。
          </p>
          <JoinedSpacesSection />
        </section>

        {/* コミュニティ内の個人スペース */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>コミュニティ内の個人スペース</h2>
          <p className={styles.sectionDesc}>
            参加中のコミュニティごとに、あなた専用の個人スペースを作成・入室できます。
          </p>
          <CommunityPersonalSpacesSection />
        </section>

        {/* マイHossii */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>マイHossii</h2>
          <p className={styles.sectionDesc}>
            ログインアカウントに紐づく、あなたのHossiiを登録できます。
          </p>
          <MyHossiiSettingsSection
            currentUser={currentUser}
            activeSpaceId={activeSpaceId}
            activeSpaceName={activeSpace?.name ?? null}
            spaceMyHossiiEnabled={activeSpace?.myHossiiEnabled ?? false}
            deviceProfileId={profile?.id ?? null}
            defaultNickname={profile?.defaultNickname || currentUser?.username || null}
            refreshKey={nicknameSaveRevision}
          />
        </section>

        {/* このスペースでのニックネーム */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>このスペースでのニックネーム</h2>
          {activeSpace && (
            <p className={styles.sectionDesc}>スペース: {activeSpace.name}</p>
          )}
          <p className={styles.sectionDesc}>
            未設定の場合はデフォルトニックネームが使われます。
          </p>
          <div className={styles.inputRow}>
            <input
              type="text"
              className={styles.input}
              placeholder={profile?.defaultNickname || 'ニックネームを入力'}
              value={spaceNicknameInput}
              onChange={(e) => setSpaceNicknameInput(e.target.value)}
              {...nicknameInputAntiAutofillProps}
            />
            <button
              type="button"
              className={styles.saveButton}
              onClick={handleSaveSpaceNickname}
              disabled={!spaceNicknameInput.trim()}
            >
              {savedSpace ? '保存済み ✓' : '保存'}
            </button>
          </div>
          {spaceNicknames[activeSpaceId] && (
            <p className={styles.currentValue}>現在の設定: {spaceNicknames[activeSpaceId]}</p>
          )}
        </section>

        {/* デフォルトニックネーム */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>デフォルトニックネーム</h2>
          <p className={styles.sectionDesc}>
            全スペース共通の表示名です。スペース別ニックネームが優先されます。
          </p>
          <div className={styles.inputRow}>
            <input
              type="text"
              className={styles.input}
              placeholder="ニックネームを入力"
              value={defaultNicknameInput}
              onChange={(e) => setDefaultNicknameInput(e.target.value)}
              {...nicknameInputAntiAutofillProps}
            />
            <button
              type="button"
              className={styles.saveButton}
              onClick={handleSaveDefaultNickname}
              disabled={!defaultNicknameInput.trim()}
            >
              {savedDefault ? '保存済み ✓' : '保存'}
            </button>
          </div>
          {profile?.defaultNickname && (
            <p className={styles.currentValue}>現在の設定: {profile.defaultNickname}</p>
          )}
        </section>

      </main>
    </div>
  );
};
