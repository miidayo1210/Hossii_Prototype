import type { SpaceSettings, BackgroundPattern } from '../../core/types/settings';
import styles from './BackgroundTab.module.css';

type Props = {
  settings: SpaceSettings;
  onUpdate: (settings: SpaceSettings) => void;
};

const BACKGROUND_OPTIONS: Array<{ value: BackgroundPattern; label: string; description: string }> = [
  { value: 'standard', label: '標準', description: '基本の宇宙背景' },
  { value: 'nebula', label: 'ネビュラ', description: '星雲のような幻想的な背景（近日公開）' },
  { value: 'galaxy', label: 'ギャラクシー', description: '銀河のような渦巻き背景（近日公開）' },
  { value: 'stars', label: 'スターフィールド', description: '星々が輝く背景（近日公開）' },
];

export const BackgroundTab = ({ settings, onUpdate }: Props) => {
  const handleBackgroundChange = (pattern: BackgroundPattern) => {
    onUpdate({ ...settings, backgroundPattern: pattern });
  };

  return (
    <div className={styles.container}>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>背景パターン</h2>
        <p className={styles.description}>
          スペースの背景デザインを選択してください
        </p>

        <div className={styles.patternList}>
          {BACKGROUND_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={`${styles.patternButton} ${
                settings.backgroundPattern === option.value ? styles.selected : ''
              } ${option.value !== 'standard' ? styles.disabled : ''}`}
              onClick={() => handleBackgroundChange(option.value)}
              disabled={option.value !== 'standard'}
            >
              <div className={styles.patternPreview}>
                <div className={`${styles.patternImage} ${styles[option.value]}`}></div>
              </div>
              <div className={styles.patternInfo}>
                <h3 className={styles.patternLabel}>{option.label}</h3>
                <p className={styles.patternDescription}>{option.description}</p>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
