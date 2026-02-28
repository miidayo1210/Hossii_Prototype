import { useState, useEffect } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { useRouter } from '../../core/hooks/useRouter';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { useAuth } from '../../core/contexts/AuthContext';
import { loadSpaceSettings, saveSpaceSettings } from '../../core/utils/settingsStorage';
import type { SpaceSettings } from '../../core/types/settings';
import type { Space } from '../../core/types/space';
import { GeneralTab } from './GeneralTab';
import { HossiiCustomTab } from './HossiiCustomTab';
import { BackgroundTab } from './BackgroundTab';
import { ShareTab } from './ShareTab';
import { ModerationTab } from './ModerationTab';
import { DecorationTab } from './DecorationTab';
import styles from './SpaceSettingsScreen.module.css';

type Tab = 'general' | 'hossii' | 'background' | 'share' | 'moderation' | 'decoration';

export const SpaceSettingsScreen = () => {
  const { navigate } = useRouter();
  const { state, updateSpace } = useHossiiStore();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.isAdmin ?? false;
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [settings, setSettings] = useState<SpaceSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const activeSpace = state.spaces.find((s) => s.id === state.activeSpaceId);

  // 設定を読み込む
  useEffect(() => {
    if (activeSpace) {
      const loadedSettings = loadSpaceSettings(activeSpace.id, activeSpace.name);
      setSettings(loadedSettings);
    }
  }, [activeSpace]);

  const handleSave = () => {
    if (!settings) return;

    setIsSaving(true);
    saveSpaceSettings(settings);

    // 保存完了のアニメーション
    setTimeout(() => {
      setIsSaving(false);
    }, 500);
  };

  const handleBack = () => {
    navigate(isAdmin ? 'spaces' : 'screen');
  };

  if (!settings || !activeSpace) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>読み込み中...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button className={styles.backButton} onClick={handleBack}>
          <ArrowLeft size={20} />
          <span>ホームに戻る</span>
        </button>

        <h1 className={styles.title}>スペース管理</h1>

        <button
          className={`${styles.saveButton} ${isSaving ? styles.saving : ''}`}
          onClick={handleSave}
          disabled={isSaving}
        >
          <Save size={18} />
          <span>{isSaving ? '保存中...' : '保存'}</span>
        </button>
      </header>

      <div className={styles.content}>
        <aside className={styles.sidebar}>
          <nav className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'general' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('general')}
            >
              基本設定
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'hossii' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('hossii')}
            >
              Hossiiカスタマイズ
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'background' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('background')}
            >
              背景設定
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'share' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('share')}
            >
              シェア / QR
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'decoration' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('decoration')}
            >
              スペース装飾
            </button>
            {isAdmin && (
              <button
                className={`${styles.tab} ${activeTab === 'moderation' ? styles.activeTab : ''}`}
                onClick={() => setActiveTab('moderation')}
              >
                モデレーション
              </button>
            )}
          </nav>
        </aside>

        <main className={styles.main}>
          {activeTab === 'general' && (
            <GeneralTab settings={settings} onUpdate={setSettings} />
          )}
          {activeTab === 'hossii' && (
            <HossiiCustomTab
              settings={settings}
              onUpdate={setSettings}
              space={activeSpace}
              onUpdateSpace={(patch: Partial<Space>) => updateSpace(activeSpace.id, patch)}
            />
          )}
          {activeTab === 'background' && (
            <BackgroundTab settings={settings} onUpdate={setSettings} />
          )}
          {activeTab === 'share' && (
            <ShareTab />
          )}
          {activeTab === 'decoration' && activeSpace && (
            <DecorationTab space={activeSpace} />
          )}
          {activeTab === 'moderation' && activeSpace && (
            <ModerationTab spaceId={activeSpace.id} />
          )}
        </main>
      </div>
    </div>
  );
};
