import type { LucideIcon } from 'lucide-react';
import { Instagram, MessageCircleQuestion } from 'lucide-react';
import {
  getVisibleHossiiSupportLinks,
  type HossiiSupportLinkId,
} from '../../core/config/hossiiSupportLinks';
import styles from './AccountScreen.module.css';

const SUPPORT_LINK_ICONS: Partial<Record<HossiiSupportLinkId, LucideIcon>> = {
  feedback: MessageCircleQuestion,
  instagram: Instagram,
};

function XIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

type Props = {
  links?: ReturnType<typeof getVisibleHossiiSupportLinks>;
};

export const HossiiAboutSection = ({ links = getVisibleHossiiSupportLinks() }: Props) => {
  if (links.length === 0) return null;

  return (
    <section className={styles.supportSection} aria-labelledby="hossii-about-heading">
      <h2 id="hossii-about-heading" className={styles.sectionTitle}>
        Hossiiについて
      </h2>
      <ul className={styles.supportLinkList}>
        {links.map((link) => {
          const Icon = link.id === 'x' ? null : SUPPORT_LINK_ICONS[link.id];
          return (
            <li key={link.id}>
              <a
                className={styles.supportLinkRow}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={link.ariaLabel}
              >
                <span className={styles.supportLinkIcon}>
                  {link.id === 'x' ? (
                    <XIcon size={18} />
                  ) : (
                    Icon && <Icon size={18} />
                  )}
                </span>
                <span className={styles.supportLinkText}>
                  <span className={styles.supportLinkLabel}>{link.label}</span>
                  {link.description ? (
                    <span className={styles.supportLinkDescription}>{link.description}</span>
                  ) : null}
                </span>
                <span className={styles.supportLinkExternal} aria-hidden="true">
                  ↗
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
