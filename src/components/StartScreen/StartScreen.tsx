import { HossiiLive } from '../Hossii/HossiiLive';
import styles from './StartScreen.module.css';

export const StartScreen = () => {
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
        <div className={styles.header}>
          <h1 className={styles.logo}>✨</h1>
          <h2 className={styles.title}>Hossii</h2>
          <p className={styles.subtitle}>
            あなたの気持ちを、宇宙に置いていこう
          </p>
        </div>

        <p className={styles.hint}>
          スペースの URL から参加してください
        </p>
      </div>
    </div>
  );
};
