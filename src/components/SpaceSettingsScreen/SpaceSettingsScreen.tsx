import { useState, useEffect } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { useRouter } from '../../core/hooks/useRouter';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { useAuth } from '../../core/contexts/AuthContext';
import { saveSpaceSettings } from '../../core/utils/settingsStorage';
import { fetchSpaceSettings, upsertSpaceSettings } from '../../core/utils/spaceSettingsApi';
import type { SpaceSettings } from '../../core/types/settings';
import type { Space } from '../../core/types/space';
import { GeneralTab } from './GeneralTab';
import { HossiiCustomTab } from './HossiiCustomTab';
import { BackgroundTab } from './BackgroundTab';
import { ShareTab } from './ShareTab';
import { ModerationTab } from './ModerationTab';
import { DecorationTab } from './DecorationTab';
import { FeatureFlagsTab } from './FeatureFlagsTab';
import styles from './SpaceSettingsScreen.module.css';

type Tab = 'general' | 'hossii' | 'background' | 'share' | 'moderation' | 'decoration' | 'featureFlags';

export const SpaceSettingsScreen = () => {
  const { navigate } = useRouter();
  const { state, updateSpace } = useHossiiStore();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.isAdmin ?? false;
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [settings, setSettings] = useState<SpaceSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const activeSpace = state.spaces.find((s) => s.id === state.activeSpaceId);

  // 設定を読み込む（Supabase 優先、フォールバックは localStorage）
  useEffect(() => {
    if (!activeSpace) return;
    fetchSpaceSettings(activeSpace.id, activeSpace.name).then((loaded) => {
      setSettings(loaded);
      // localStorage にも同期してオフライン表示を保証
      saveSpaceSettings(loaded);
    });
  }, [activeSpace?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    if (!settings) return;

    setIsSaving(true);
    // localStorage に即時保存（楽観的更新）
    saveSpaceSettings(settings);
    // Supabase に非同期で保存
    await upsertSpaceSettings(settings);

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
            {isAdmin && (
              <button
                className={`${styles.tab} ${activeTab === 'featureFlags' ? styles.activeTab : ''}`}
                onClick={() => setActiveTab('featureFlags')}
              >
                Feature Flags
              </button>
            )}
          </nav>
        </aside>

        <main className={styles.main}>
          {activeTab === 'general' && (
            <GeneralTab
              settings={settings}
              onUpdate={setSettings}
              space={activeSpace}
              onUpdateSpace={(patch: Partial<Space>) => updateSpace(activeSpace.id, patch)}
            />
          )}
          {activeTab === 'hossii' && (
            <HossiiCustomTab
              settings={settings}
              onUpdate={setSettings}
              space={activeSpace}
              onUpdateSpace={(patch: Partial<Space>) => updateSpace(activeSpace.id, patch)}
            />
          )}
          {activeTab === 'background' && activeSpace && (
            <BackgroundTab
              space={activeSpace}
              onUpdateSpace={(patch) => updateSpace(activeSpace.id, patch)}
            />
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
          {activeTab === 'featureFlags' && activeSpace && (
            <FeatureFlagsTab spaceId={activeSpace.id} />
          )}
        </main>
      </div>
    </div>
  );
};
