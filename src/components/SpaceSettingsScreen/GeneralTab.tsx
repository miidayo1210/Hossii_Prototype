import type { SpaceSettings, CardType, BubbleEditPermission } from '../../core/types/settings';
import type { Space } from '../../core/types/space';
import { BUBBLE_SHAPE_PRESETS } from '../../core/assets/bubbleShapes';
import styles from './GeneralTab.module.css';

type Props = {
  settings: SpaceSettings;
  onUpdate: (settings: SpaceSettings) => void;
  space?: Space;
  onUpdateSpace?: (patch: Partial<Space>) => void;
};

export const GeneralTab = ({ settings, onUpdate, space, onUpdateSpace }: Props) => {
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

  const handleBubbleEditPermissionChange = (bubbleEditPermission: BubbleEditPermission) => {
    onUpdate({ ...settings, bubbleEditPermission });
  };

  const handleIsPrivateToggle = () => {
    onUpdateSpace?.({ isPrivate: !(space?.isPrivate ?? false) });
  };

  const handleBubbleShapeChange = (shapePath: string | undefined) => {
    onUpdateSpace?.({ bubbleShapePng: shapePath });
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

          <label className={styles.toggleItem}>
            <span className={styles.toggleLabel}>いいね機能</span>
            <input
              type="checkbox"
              className={styles.toggle}
              checked={settings.features.likesEnabled}
              onChange={() => handleFeatureToggle('likesEnabled')}
            />
            <span className={styles.toggleSlider}></span>
          </label>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>バブル編集権限</h2>
        <p className={styles.description}>スペース上で吹き出しを移動・リサイズ・色変更できるユーザーを設定します。</p>
        <div className={styles.radioList}>
          <label className={styles.radioItem}>
            <input
              type="radio"
              name="bubbleEditPermission"
              checked={settings.bubbleEditPermission === 'all'}
              onChange={() => handleBubbleEditPermissionChange('all')}
            />
            <span className={styles.radioLabel}>全員が編集可能</span>
          </label>
          <label className={styles.radioItem}>
            <input
              type="radio"
              name="bubbleEditPermission"
              checked={settings.bubbleEditPermission === 'owner_and_admin'}
              onChange={() => handleBubbleEditPermissionChange('owner_and_admin')}
            />
            <span className={styles.radioLabel}>投稿者本人と管理者のみ</span>
          </label>
        </div>
      </section>

      {onUpdateSpace && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>プライバシー設定</h2>
          <p className={styles.description}>ONにするとこのスペースは本人のみアクセスできます（内省スペース向け）。</p>
          <div className={styles.toggleList}>
            <label className={styles.toggleItem}>
              <span className={styles.toggleLabel}>非公開スペース</span>
              <input
                type="checkbox"
                className={styles.toggle}
                checked={space?.isPrivate ?? false}
                onChange={handleIsPrivateToggle}
              />
              <span className={styles.toggleSlider}></span>
            </label>
          </div>
        </section>
      )}

      {onUpdateSpace && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>吹き出しの形</h2>
          <p className={styles.description}>
            スペース内のすべての吹き出しに適用される形状を選択します。
            {BUBBLE_SHAPE_PRESETS.length === 0 && (
              <> カスタム形状を追加するには PNG ファイルを <code>public/assets/bubble-shapes/</code> に格納してください。</>
            )}
          </p>
          <div className={styles.shapeList}>
            <button
              type="button"
              className={`${styles.shapeOption} ${!space?.bubbleShapePng ? styles.shapeOptionActive : ''}`}
              onClick={() => handleBubbleShapeChange(undefined)}
            >
              <span className={styles.shapePreviewDefault} />
              <span className={styles.shapeLabel}>デフォルト（角丸）</span>
            </button>
            {BUBBLE_SHAPE_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                className={`${styles.shapeOption} ${space?.bubbleShapePng === preset.path ? styles.shapeOptionActive : ''}`}
                onClick={() => handleBubbleShapeChange(preset.path)}
              >
                <img
                  src={preset.path}
                  alt={preset.label}
                  className={styles.shapePreviewImg}
                />
                <span className={styles.shapeLabel}>{preset.label}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {onUpdateSpace && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>ウェルカムメッセージ</h2>
          <p className={styles.description}>入室時にHossiiキャラが話すメッセージを設定します。未設定時はデフォルト文言が表示されます。</p>
          <textarea
            className={styles.textarea}
            value={space?.welcomeMessage ?? ''}
            onChange={(e) => onUpdateSpace({ welcomeMessage: e.target.value || undefined })}
            placeholder={`「${space?.name ?? 'スペース'}」にようこそ！ニックネームを入力してね。`}
            maxLength={100}
            rows={3}
          />
          <p className={styles.charCount}>{(space?.welcomeMessage ?? '').length} / 100</p>
        </section>
      )}

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
