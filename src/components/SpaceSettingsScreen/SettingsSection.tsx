import type { ReactNode } from 'react';
import styles from './SettingsShared.module.css';

type Props = {
  title?: string;
  description?: string;
  children: ReactNode;
};

export const SettingsSection = ({ title, description, children }: Props) => (
  <section className={styles.section}>
    {title && <h2 className={styles.sectionTitle}>{title}</h2>}
    {description && <p className={styles.sectionDescription}>{description}</p>}
    {children}
  </section>
);
