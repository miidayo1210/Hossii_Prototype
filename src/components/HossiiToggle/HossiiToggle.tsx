import { useState } from 'react';
import { useDisplayPrefs } from '../../core/contexts/DisplayPrefsContext';
import { ListenConsentModal } from '../ListenConsentModal/ListenConsentModal';
import styles from './HossiiToggle.module.css';

export const HossiiToggle = () => {
  const {
    prefs: { showHossii, listenMode, hasConsentedToListen },
    setShowHossii,
    setListenMode,
    setListenConsent,
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
      </div>

      {/* 同意確認モーダル */}
      {showConsentModal && (
        <ListenConsentModal onConsent={handleConsent} onCancel={handleCancel} />
      )}
    </>
  );
};
