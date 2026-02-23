import { useState } from 'react';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { TopRightMenu } from '../Navigation/TopRightMenu';
import styles from './ProfileScreen.module.css';

export const ProfileScreen = () => {
  const {
    state,
    setDefaultNickname,
    setSpaceNickname,
    getActiveSpace,
  } = useHossiiStore();

  const { profile, spaceNicknames, activeSpaceId } = state;
  const activeSpace = getActiveSpace();

  // デフォルトニックネーム編集
  const [defaultNicknameInput, setDefaultNicknameInput] = useState(
    profile?.defaultNickname || ''
  );

  // スペースのニックネーム編集
  const [spaceNicknameInput, setSpaceNicknameInput] = useState(
    spaceNicknames[activeSpaceId] || ''
  );

  const handleSaveDefaultNickname = () => {
    const trimmed = defaultNicknameInput.trim();
    if (trimmed) {
      setDefaultNickname(trimmed);
    }
  };

  const handleSaveSpaceNickname = () => {
    const trimmed = spaceNicknameInput.trim();
    if (trimmed) {
      setSpaceNickname(activeSpaceId, trimmed);
    }
  };

  return (
    <div className={styles.container}>
      <TopRightMenu />

      {/* ヘッダー */}
      <header className={styles.header}>
        <h1 className={styles.title}>プロフィール</h1>
      </header>

      {/* メインコンテンツ */}
      <main className={styles.main}>
        {/* デフォルトニックネーム */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>わたしのニックネーム</h2>
          <p className={styles.sectionDescription}>
            スペースに入った時のデフォルト表示名です
          </p>
          <div className={styles.inputRow}>
            <input
              type="text"
              className={styles.input}
              placeholder="ニックネームを入力"
              value={defaultNicknameInput}
              onChange={(e) => setDefaultNicknameInput(e.target.value)}
            />
            <button
              type="button"
              className={styles.saveButton}
              onClick={handleSaveDefaultNickname}
              disabled={!defaultNicknameInput.trim()}
            >
              保存
            </button>
          </div>
          {profile?.defaultNickname && (
            <p className={styles.currentValue}>
              現在の設定: {profile.defaultNickname}
            </p>
          )}
        </section>

        {/* アクティブなスペースの情報 */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>現在のスペース</h2>
          {activeSpace && (
            <div className={styles.spaceInfo}>
              <div className={styles.spaceName}>{activeSpace.name}</div>
            </div>
          )}
        </section>

        {/* スペースのニックネーム */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>このスペースでのニックネーム</h2>
          <p className={styles.sectionDescription}>
            このスペースだけで使う表示名を設定できます
          </p>
          <div className={styles.inputRow}>
            <input
              type="text"
              className={styles.input}
              placeholder={profile?.defaultNickname || 'ニックネームを入力'}
              value={spaceNicknameInput}
              onChange={(e) => setSpaceNicknameInput(e.target.value)}
            />
            <button
              type="button"
              className={styles.saveButton}
              onClick={handleSaveSpaceNickname}
              disabled={!spaceNicknameInput.trim()}
            >
              保存
            </button>
          </div>
          {spaceNicknames[activeSpaceId] && (
            <p className={styles.currentValue}>
              現在の設定: {spaceNicknames[activeSpaceId]}
            </p>
          )}
        </section>
      </main>
    </div>
  );
};
