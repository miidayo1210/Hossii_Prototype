import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { SettingsNav } from './SettingsNav';
import { SettingsPaneSelector } from './SettingsPaneSelector';
import type { SettingsScreenId } from './settingsScreenIds';
import { PANE_OVERRIDE_SCREENS } from './settingsScreenIds';
import shellStyles from './SpaceSettingsScreen.module.css';
import styles from './SettingsShared.module.css';

type Props = {
  spaceName: string;
  activeScreen: SettingsScreenId;
  isAdmin: boolean;
  onBack: () => void;
  onNavigate: (id: SettingsScreenId) => void;
  children: ReactNode;
};

export const SettingsLayout = ({
  spaceName,
  activeScreen,
  isAdmin,
  onBack,
  onNavigate,
  children,
}: Props) => (
  <div className={shellStyles.container}>
    <header className={shellStyles.header}>
      <button type="button" className={shellStyles.backButton} onClick={onBack}>
        <ArrowLeft size={20} />
        <span>ホームに戻る</span>
      </button>
      <div className={styles.headerTitleBlock}>
        <h1 className={shellStyles.title}>スペース管理</h1>
        <span className={styles.headerSubtitle}>{spaceName}</span>
      </div>
      <div className={styles.headerSpacer} aria-hidden="true" />
    </header>

    <div className={shellStyles.content}>
      <aside className={shellStyles.sidebar}>
        <SettingsNav activeScreen={activeScreen} onNavigate={onNavigate} isAdmin={isAdmin} />
      </aside>
      <main className={shellStyles.main}>
        {PANE_OVERRIDE_SCREENS.has(activeScreen) && <SettingsPaneSelector />}
        {children}
      </main>
    </div>
  </div>
);
