import { useMemo } from 'react';
import { TopRightMenu } from '../Navigation/TopRightMenu';
import { useAuth } from '../../core/contexts/useAuth';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { useRouter } from '../../core/hooks/useRouter';
import { useSelectedCommunity } from '../../core/contexts/useSelectedCommunity';
import { resolveAccountIdentity } from '../../core/utils/resolveAccountIdentity';
import { resolveAccountSection } from './accountSection';
import { AccountSectionNav } from './AccountSectionNav';
import { AccountHomeSection } from './AccountHomeSection';
import { resolveCommunitySummary } from './accountCommunitySummary';
import styles from './AccountScreen.module.css';

type Props = {
  onLoginRequested?: () => void;
  onSignUpRequested?: () => void;
};

export const AccountScreen = ({ onLoginRequested, onSignUpRequested }: Props) => {
  void onLoginRequested;
  void onSignUpRequested;
  const { currentUser } = useAuth();
  const { screenParam, navigate } = useRouter();
  const activeSection = resolveAccountSection(screenParam);
  const { selectedMembership } = useSelectedCommunity();
  const { state } = useHossiiStore();
  const { profile, spaceNicknames, activeSpaceId } = state;

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

  const communitySummary = resolveCommunitySummary(
    Boolean(currentUser),
    selectedMembership?.communityName,
  );

  return (
    <div className={styles.container}>
      <TopRightMenu />

      <header className={styles.header}>
        <h1 className={styles.title}>アカウント</h1>
      </header>

      <AccountSectionNav activeSection={activeSection} onNavigate={navigate} />

      <main className={styles.content} data-account-section={activeSection}>

        {activeSection === 'home' && (
          <AccountHomeSection
            identity={identity}
            communitySummary={communitySummary}
            onNavigate={navigate}
          />
        )}

        {activeSection === 'profile' && (
          <div data-testid="account-section-profile" className={styles.sectionPlaceholder}>
            <h2 className={styles.sectionTitle}>プロフィール</h2>
            <p className={styles.sectionDesc}>表示名・ニックネーム・認証操作（移管予定）</p>
          </div>
        )}

        {activeSection === 'spaces' && (
          <div data-testid="account-section-spaces" className={styles.sectionPlaceholder}>
            <h2 className={styles.sectionTitle}>参加先</h2>
            <p className={styles.sectionDesc}>コミュニティとスペース（移管予定）</p>
          </div>
        )}

        {activeSection === 'my-hossii' && (
          <div data-testid="account-section-my-hossii" className={styles.sectionPlaceholder}>
            <h2 className={styles.sectionTitle}>マイHossii</h2>
            <p className={styles.sectionDesc}>Hossiiの登録と登場（移管予定）</p>
          </div>
        )}

      </main>
    </div>
  );
};
