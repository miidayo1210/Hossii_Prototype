import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import styles from './SettingsShared.module.css';
import type { SettingsScreenId } from './settingsScreenIds';
import { SETTINGS_NAV_GROUPS } from './settingsScreenIds';

type Props = {
  activeScreen: SettingsScreenId;
  onNavigate: (id: SettingsScreenId) => void;
  isAdmin: boolean;
};

function getInitialOpenGroups(activeScreen: SettingsScreenId): Set<string> {
  const open = new Set<string>();
  for (const group of SETTINGS_NAV_GROUPS) {
    if (group.items.some((item) => item.id === activeScreen)) {
      open.add(group.heading);
    }
  }
  return open;
}

export const SettingsNav = ({ activeScreen, onNavigate, isAdmin }: Props) => {
  const [openGroups, setOpenGroups] = useState<Set<string>>(() =>
    getInitialOpenGroups(activeScreen),
  );

  const toggleGroup = (heading: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(heading)) next.delete(heading);
      else next.add(heading);
      return next;
    });
  };

  const handleNavigate = (id: SettingsScreenId, groupHeading: string) => {
    setOpenGroups((prev) => new Set([...prev, groupHeading]));
    onNavigate(id);
  };

  return (
    <nav className={styles.nav}>
      {SETTINGS_NAV_GROUPS.map((group) => {
        const items = group.items.filter((item) => !item.adminOnly || isAdmin);
        if (items.length === 0) return null;
        const isOpen = openGroups.has(group.heading);

        return (
          <div key={group.heading} className={styles.navGroup}>
            <button
              type="button"
              className={styles.navGroupHeading}
              onClick={() => toggleGroup(group.heading)}
              aria-expanded={isOpen}
            >
              <span>{group.heading}</span>
              <ChevronRight
                size={13}
                className={`${styles.navGroupChevron} ${isOpen ? styles.navGroupChevronOpen : ''}`}
              />
            </button>

            <div
              className={`${styles.navGroupItems} ${isOpen ? styles.navGroupItemsOpen : ''}`}
              aria-hidden={!isOpen}
            >
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`${styles.navItem} ${activeScreen === item.id ? styles.navItemActive : ''}`}
                  onClick={() => handleNavigate(item.id, group.heading)}
                  tabIndex={isOpen ? 0 : -1}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
};
