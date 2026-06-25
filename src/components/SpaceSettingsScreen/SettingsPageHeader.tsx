import type { ReactNode } from 'react';
import styles from './SettingsShared.module.css';

type Props = {
  title: string;
  description?: string;
  children: ReactNode;
};

export const SettingsPageHeader = ({ title, description, children }: Props) => (
  <>
    <h1 className={styles.pageTitle}>{title}</h1>
    {description && <p className={styles.pageDescription}>{description}</p>}
    <div className={styles.pageBody}>{children}</div>
  </>
);
