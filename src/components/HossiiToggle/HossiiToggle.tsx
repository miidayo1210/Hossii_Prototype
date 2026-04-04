import { useState } from 'react';
import { useDisplayPrefs } from '../../core/contexts/DisplayPrefsContext';
import { ListenConsentModal } from '../ListenConsentModal/ListenConsentModal';
import type { SpeechLevel } from '../../core/types';
import styles from './HossiiToggle.module.css';

export const HossiiToggle = () => {
  const {
    prefs: {
      showHossii,
      listenMode,
      hasConsentedToListen,
      speechLogEnabled,
      speechLevels,
    },
    setShowHossii,
    setListenMode,
    setListenConsent,
    setSpeechLogEnabled,
    setSpeechLevels,
  } = useDisplayPrefs();
  const [showConsentModal, setShowConsentModal] = useState(false);

  const handleHossiiToggle = () => {
    setShowHossii(!showHossii);
  };

  const handleListenToggle = () => {
    if (listenMode) {
      // OFF にする
      setListenMode(false);
    } else {
      // ON にしようとしている
      if (hasConsentedToListen) {
        // 同意済みならすぐに ON
        setListenMode(true);
      } else {
        // 未同意なら確認モーダル表示
        setShowConsentModal(true);
      }
    }
  };

  const handleConsent = () => {
    setListenConsent(true);
    setListenMode(true);
    setShowConsentModal(false);
  };

  const handleCancel = () => {
    setShowConsentModal(false);
  };

  const handleSpeechLevelChange = (level: SpeechLevel) => {
    setSpeechLevels({
      ...speechLevels,
      [level]: !speechLevels[level],
    });
  };

  return (
    <>
      <div className={styles.container}>
        {/* Hossii ON/OFF */}
        <button
          type="button"
          className={styles.toggle}
          onClick={handleHossiiToggle}
          aria-label={`Hossii表示切替: ${showHossii ? 'ON' : 'OFF'}`}
        >
          <span className={styles.icon}>👻</span>
          <span className={styles.label}>Hossii</span>
          <span className={`${styles.status} ${showHossii ? styles.statusOn : styles.statusOff}`}>
            {showHossii ? 'ON' : 'OFF'}
          </span>
        </button>

        {/* Listen ON/OFF */}
        <button
          type="button"
          className={`${styles.toggle} ${styles.listenToggle}`}
          onClick={handleListenToggle}
          aria-label={`Listen切替: ${listenMode ? 'ON' : 'OFF'}`}
        >
          <span className={styles.icon}>🎤</span>
          <span className={styles.label}>Listen</span>
          <span className={`${styles.status} ${listenMode ? styles.statusOn : styles.statusOff}`}>
            {listenMode ? 'ON' : 'OFF'}
          </span>
        </button>

        {/* Listen オプション（Listen ON時のみ表示） */}
        {listenMode && (
          <div className={styles.listenOptions}>
            {/* ことばログ ON/OFF */}
            <label className={styles.optionRow}>
              <input
                type="checkbox"
                checked={speechLogEnabled}
                onChange={() => setSpeechLogEnabled(!speechLogEnabled)}
                className={styles.checkbox}
              />
              <span className={styles.optionIcon}>🎙</span>
              <span className={styles.optionLabel}>ことばログ</span>
            </label>

            {/* ことばログ粒度設定（ことばログON時のみ） */}
            {speechLogEnabled && (
              <div className={styles.levelOptions}>
                <label className={styles.levelRow}>
                  <input
                    type="checkbox"
                    checked={speechLevels.word}
                    onChange={() => handleSpeechLevelChange('word')}
                    className={styles.checkbox}
                  />
                  <span className={styles.levelLabel}>単語</span>
                </label>
                <label className={styles.levelRow}>
                  <input
                    type="checkbox"
                    checked={speechLevels.short}
                    onChange={() => handleSpeechLevelChange('short')}
                    className={styles.checkbox}
                  />
                  <span className={styles.levelLabel}>短文</span>
                </label>
                <label className={styles.levelRow}>
                  <input
                    type="checkbox"
                    checked={speechLevels.long}
                    onChange={() => handleSpeechLevelChange('long')}
                    className={styles.checkbox}
                  />
                  <span className={styles.levelLabel}>長文</span>
                </label>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 同意確認モーダル */}
      {showConsentModal && (
        <ListenConsentModal onConsent={handleConsent} onCancel={handleCancel} />
      )}
    </>
  );
};
