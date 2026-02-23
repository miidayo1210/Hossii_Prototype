import type { SpaceSettings, HossiiColor } from '../../core/types/settings';
import styles from './HossiiCustomTab.module.css';

type Props = {
  settings: SpaceSettings;
  onUpdate: (settings: SpaceSettings) => void;
};

const COLOR_OPTIONS: Array<{ value: HossiiColor; label: string; hex: string }> = [
  { value: 'pink', label: 'ピンク', hex: '#ec4899' },
  { value: 'blue', label: 'ブルー', hex: '#3b82f6' },
  { value: 'yellow', label: 'イエロー', hex: '#fbbf24' },
  { value: 'green', label: 'グリーン', hex: '#10b981' },
  { value: 'purple', label: 'パープル', hex: '#a855f7' },
];

export const HossiiCustomTab = ({ settings, onUpdate }: Props) => {
  const handleColorChange = (color: HossiiColor) => {
    onUpdate({ ...settings, hossiiColor: color });
  };

  const selectedColor = COLOR_OPTIONS.find((c) => c.value === settings.hossiiColor);

  return (
    <div className={styles.container}>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Hossiiのカラー</h2>
        <p className={styles.description}>
          このスペースに住むHossiiの色を選択してください
        </p>

        <div className={styles.colorGrid}>
          {COLOR_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={`${styles.colorButton} ${
                settings.hossiiColor === option.value ? styles.selected : ''
              }`}
              onClick={() => handleColorChange(option.value)}
              style={{ '--color': option.hex } as React.CSSProperties}
            >
              <div className={styles.colorCircle}></div>
              <span className={styles.colorLabel}>{option.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>プレビュー</h2>
        <div className={styles.preview}>
          <div
            className={styles.hossiiPreview}
            style={{
              filter: `hue-rotate(${getHueRotation(settings.hossiiColor)}deg)`,
            }}
          >
            🐟
          </div>
          <p className={styles.previewLabel}>
            選択中: {selectedColor?.label}
          </p>
        </div>
      </section>
    </div>
  );
};

// Hueローテーション値を計算（簡易的な実装）
const getHueRotation = (color: HossiiColor): number => {
  switch (color) {
    case 'pink':
      return 0; // デフォルト
    case 'blue':
      return 180;
    case 'yellow':
      return 45;
    case 'green':
      return 120;
    case 'purple':
      return 270;
    default:
      return 0;
  }
};
