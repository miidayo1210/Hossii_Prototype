import { useAuth } from '../../core/contexts/useAuth';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { MyHossiiSettingsSection } from './MyHossiiSettingsSection';
import styles from './AccountScreen.module.css';

type Props = {
  nicknameSaveRevision?: number;
};

export const AccountMyHossiiSection = ({ nicknameSaveRevision = 0 }: Props) => {
  const { currentUser } = useAuth();
  const { state, getActiveSpace } = useHossiiStore();
  const { profile, activeSpaceId } = state;
  const activeSpace = getActiveSpace();

  return (
    <div data-testid="account-section-my-hossii" className={styles.sectionStack}>
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
    </div>
  );
};
