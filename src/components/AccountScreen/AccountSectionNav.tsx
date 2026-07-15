import type { AccountSection } from './accountSection';
import { accountSectionToParam } from './accountSection';
import styles from './AccountSectionNav.module.css';

type SectionItem = {
  id: AccountSection;
  label: string;
};

const SECTIONS: SectionItem[] = [
  { id: 'home', label: 'ホーム' },
  { id: 'profile', label: 'プロフィール' },
  { id: 'spaces', label: '参加先' },
  { id: 'my-hossii', label: 'マイHossii' },
];

type Props = {
  activeSection: AccountSection;
  onNavigate: (screen: 'account', param?: string) => void;
};

export const AccountSectionNav = ({ activeSection, onNavigate }: Props) => {
  return (
    <nav className={styles.nav} aria-label="アカウント画面の区分">
      <div className={styles.segmentGroup} role="tablist">
        {SECTIONS.map((section) => {
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`${styles.segmentButton} ${isActive ? styles.segmentActive : ''}`}
              onClick={() => onNavigate('account', accountSectionToParam(section.id))}
            >
              {section.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
