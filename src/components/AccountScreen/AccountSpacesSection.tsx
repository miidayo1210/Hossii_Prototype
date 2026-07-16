import { useAuth } from '../../core/contexts/useAuth';
import { useRouter } from '../../core/hooks/useRouter';
import { CommunitySwitcher } from '../Community/CommunitySwitcher';
import { JoinedSpacesSection } from './JoinedSpacesSection';
import { CommunityPersonalSpacesSection } from './CommunityPersonalSpacesSection';
import { MY_SPACE_INTRO } from '../../core/utils/mySpaceCopy';
import styles from './AccountScreen.module.css';

export const AccountSpacesSection = () => {
  const { currentUser } = useAuth();
  const { navigate } = useRouter();

  return (
    <div data-testid="account-section-spaces" className={styles.sectionStack}>
      {currentUser && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>所属コミュニティ</h2>
          <p className={styles.sectionDesc}>
            複数のコミュニティに所属している場合は、ここで切り替えられます。
          </p>
          <CommunitySwitcher onNavigateHome={(id) => navigate('community', id)} />
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>参加しているスペース</h2>
        <p className={styles.sectionDesc}>
          あなたがログインして参加したスペースの一覧です。
        </p>
        <JoinedSpacesSection />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>コミュニティ内のマイスペース</h2>
        <p className={styles.sectionDesc}>
          {MY_SPACE_INTRO} 参加中のコミュニティごとに、有無を確認し、未作成の場合はここから作れます。
        </p>
        <CommunityPersonalSpacesSection />
      </section>
    </div>
  );
};
