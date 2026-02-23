import { useState } from 'react';
import { HossiiLive } from '../Hossii/HossiiLive';
import { LoginScreen } from '../Auth/LoginScreen';
import styles from './StartScreen.module.css';

export const StartScreen = () => {
  const [showLogin, setShowLogin] = useState(false);

  return (
    <div className={styles.container}>
      {/* Background stars */}
      <div className={styles.stars}></div>
      <div className={styles.stars2}></div>
      <div className={styles.stars3}></div>

      {/* Background Hossii (ambient, non-interactive) */}
      <div className={styles.hossiiBackground}>
        <HossiiLive
          isListening={false}
          onParticle={() => {}}
        />
      </div>

      {/* Main content */}
      <div className={styles.content}>
        {/* Logo and title */}
        <div className={styles.header}>
          <h1 className={styles.logo}>✨</h1>
          <h2 className={styles.title}>Hossii</h2>
          <p className={styles.subtitle}>
            あなたの気持ちを、宇宙に置いていこう
          </p>
        </div>

        {/* Start button */}
        <button
          className={styles.startButton}
          onClick={() => setShowLogin(true)}
        >
          はじめる
        </button>
      </div>

      {/* Login modal */}
      {showLogin && (
        <div className={styles.loginModal}>
          <LoginScreen onClose={() => setShowLogin(false)} />
        </div>
      )}
    </div>
  );
};
