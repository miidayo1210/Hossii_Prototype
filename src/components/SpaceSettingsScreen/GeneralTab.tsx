import type { SpaceSettings, CardType } from '../../core/types/settings';
import styles from './GeneralTab.module.css';

type Props = {
  settings: SpaceSettings;
  onUpdate: (settings: SpaceSettings) => void;
};

export const GeneralTab = ({ settings, onUpdate }: Props) => {
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ ...settings, spaceName: e.target.value });
  };

  const handleFeatureToggle = (feature: keyof SpaceSettings['features']) => {
    onUpdate({
      ...settings,
      features: {
        ...settings.features,
        [feature]: !settings.features[feature],
      },
    });
  };

  const handleCardTypeChange = (cardType: CardType) => {
    onUpdate({ ...settings, cardType });
  };

  return (
    <div className={styles.container}>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>スペースの名前</h2>
        <input
          type="text"
          className={styles.nameInput}
          value={settings.spaceName}
          onChange={handleNameChange}
          placeholder="スペースの名前を入力"
        />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>機能のON/OFF</h2>
        <div className={styles.toggleList}>
          <label className={styles.toggleItem}>
            <span className={styles.toggleLabel}>コメント投稿</span>
            <input
              type="checkbox"
              className={styles.toggle}
              checked={settings.features.commentPost}
              onChange={() => handleFeatureToggle('commentPost')}
            />
            <span className={styles.toggleSlider}></span>
          </label>

          <label className={styles.toggleItem}>
            <span className={styles.toggleLabel}>気持ち投稿</span>
            <input
              type="checkbox"
              className={styles.toggle}
              checked={settings.features.emotionPost}
              onChange={() => handleFeatureToggle('emotionPost')}
            />
            <span className={styles.toggleSlider}></span>
          </label>

          <label className={styles.toggleItem}>
            <span className={styles.toggleLabel}>写真投稿</span>
            <input
              type="checkbox"
              className={styles.toggle}
              checked={settings.features.photoPost}
              onChange={() => handleFeatureToggle('photoPost')}
            />
            <span className={styles.toggleSlider}></span>
          </label>

          <label className={styles.toggleItem}>
            <span className={styles.toggleLabel}>数字投稿</span>
            <input
              type="checkbox"
              className={styles.toggle}
              checked={settings.features.numberPost}
              onChange={() => handleFeatureToggle('numberPost')}
            />
            <span className={styles.toggleSlider}></span>
          </label>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>カードタイプ</h2>
        <div className={styles.radioList}>
          <label className={styles.radioItem}>
            <input
              type="radio"
              name="cardType"
              checked={settings.cardType === 'stamp'}
              onChange={() => handleCardTypeChange('stamp')}
            />
            <span className={styles.radioLabel}>スタンプ</span>
          </label>

          <label className={styles.radioItem}>
            <input
              type="radio"
              name="cardType"
              checked={settings.cardType === 'constellation'}
              onChange={() => handleCardTypeChange('constellation')}
            />
            <span className={styles.radioLabel}>星座</span>
          </label>

          <label className={styles.radioItem}>
            <input
              type="radio"
              name="cardType"
              checked={settings.cardType === 'graph'}
              onChange={() => handleCardTypeChange('graph')}
            />
            <span className={styles.radioLabel}>グラフ</span>
          </label>
        </div>
      </section>
    </div>
  );
};
