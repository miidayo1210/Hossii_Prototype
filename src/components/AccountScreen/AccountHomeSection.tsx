import { ChevronRight } from 'lucide-react';
import type { AccountIdentity } from '../../core/utils/resolveAccountIdentity';
import type { AccountSection } from './accountSection';
import { accountSectionToParam } from './accountSection';
import styles from './AccountHomeSection.module.css';

type EntryCard = {
  section: Exclude<AccountSection, 'home'>;
  label: string;
  hint: string;
};

const ENTRY_CARDS: EntryCard[] = [
  { section: 'profile', label: 'プロフィール', hint: '表示名・ニックネーム' },
  { section: 'spaces', label: '参加先', hint: 'コミュニティとスペース' },
  { section: 'my-hossii', label: 'マイHossii', hint: 'Hossiiの登録と登場' },
];

type Props = {
  identity: AccountIdentity;
  communitySummary: string;
  onNavigate: (screen: 'account', param?: string) => void;
};

export const AccountHomeSection = ({ identity, communitySummary, onNavigate }: Props) => {
  return (
    <div data-testid="account-section-home" className={styles.home}>
      <section className={styles.greetingBlock} aria-live="polite">
        <p className={styles.greeting}>{identity.greeting}</p>
      </section>

      <section className={styles.summaryBlock} aria-label="現在の状態">
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>表示名</span>
          <span className={styles.summaryValue}>{identity.displayName}</span>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>ログイン状態</span>
          <span className={styles.summaryValue}>{identity.statusLabel}</span>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>コミュニティ</span>
          <span className={styles.summaryValue}>{communitySummary}</span>
        </div>
      </section>

      <nav className={styles.entryList} aria-label="区分への入口">
        {ENTRY_CARDS.map((card) => (
          <button
            key={card.section}
            type="button"
            className={styles.entryCard}
            onClick={() => onNavigate('account', accountSectionToParam(card.section))}
          >
            <span className={styles.entryText}>
              <span className={styles.entryLabel}>{card.label}</span>
              <span className={styles.entryHint}>{card.hint}</span>
            </span>
            <ChevronRight size={18} className={styles.entryArrow} aria-hidden />
          </button>
        ))}
      </nav>
    </div>
  );
};
