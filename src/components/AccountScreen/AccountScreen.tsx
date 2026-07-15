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
import { AccountProfileSection } from './AccountProfileSection';
import { AccountSpacesSection } from './AccountSpacesSection';
import { AccountMyHossiiSection } from './AccountMyHossiiSection';
import { resolveCommunitySummaryLabel } from './accountCommunitySummary';
import styles from './AccountScreen.module.css';

type Props = {
  onLoginRequested?: () => void;
  onSignUpRequested?: () => void;
};

export const AccountScreen = ({ onLoginRequested, onSignUpRequested }: Props) => {
  const { currentUser } = useAuth();
  const { screenParam, navigate } = useRouter();
  const activeSection = resolveAccountSection(screenParam);
  const { selectedMembership, loading: communityLoading } = useSelectedCommunity();
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

  const communitySummary = resolveCommunitySummaryLabel(
    communityLoading,
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
          <AccountProfileSection
            identity={identity}
            onLoginRequested={onLoginRequested}
            onSignUpRequested={onSignUpRequested}
          />
        )}

        {activeSection === 'spaces' && (
          <AccountSpacesSection />
        )}

        {activeSection === 'my-hossii' && (
          <AccountMyHossiiSection />
        )}

      </main>
    </div>
  );
};
