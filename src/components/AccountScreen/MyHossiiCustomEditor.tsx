import { useEffect, useMemo, useState } from 'react';
import {
  HOSSII_BASIC_PRESETS,
  resolveHossiiPresetImagePath,
} from '../../core/assets/hossiiPresets';
import type { MyHossiiCustomConfig } from '../../core/types/myHossiiCustom';
import {
  createDefaultMyHossiiCustomConfig,
  parseMyHossiiCustomConfig,
} from '../../core/utils/myHossiiCustomConfig';
import styles from './MyHossiiCustomEditor.module.css';

const PART_LABELS = {
  eyes: '目',
  mouth: '口',
  pattern: '模様',
  accessory: 'アクセサリー',
} as const;

type Props = {
  initialConfig: MyHossiiCustomConfig | null;
  onSave: (config: MyHossiiCustomConfig) => Promise<void>;
  onClose: () => void;
};

export const MyHossiiCustomEditor = ({ initialConfig, onSave, onClose }: Props) => {
  const [draft, setDraft] = useState<MyHossiiCustomConfig>(
    () => initialConfig ?? createDefaultMyHossiiCustomConfig(),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewImage = useMemo(
    () => resolveHossiiPresetImagePath(draft.baseKey),
    [draft.baseKey],
  );

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleSave = async () => {
    const parsed = parseMyHossiiCustomConfig(draft);
    if (!parsed) {
      setError('設定内容が無効です。ベースを選び直してください。');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSave(parsed);
      onClose();
    } catch (saveError) {
      console.error('[MyHossiiCustomEditor] save error:', saveError);
      setError(saveError instanceof Error ? saveError.message : '保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestorePreset = () => {
    setDraft(createDefaultMyHossiiCustomConfig());
    setError(null);
  };

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.editor}
        role="dialog"
        aria-modal="true"
        aria-labelledby="my-hossii-custom-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <div>
            <h2 id="my-hossii-custom-title" className={styles.title}>
              マイHossiiをカスタム
            </h2>
            <p className={styles.subtitle}>
              ベースを選んで保存できます。パーツの組み合わせは今後追加予定です。
            </p>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </header>

        <div className={styles.body}>
          <section className={styles.previewSection} aria-label="プレビュー">
            <div className={styles.previewFrame}>
              {previewImage ? (
                <img src={previewImage} alt="カスタムプレビュー" className={styles.previewImage} />
              ) : (
                <div className={styles.previewPlaceholder}>プレビュー</div>
              )}
            </div>
            <p className={styles.previewHint}>選択中のベースがスペース上で表示されます</p>
          </section>

          <section className={styles.baseSection} aria-label="ベース選択">
            <h3 className={styles.sectionTitle}>ベース</h3>
            <div className={styles.baseGrid} role="radiogroup" aria-label="ベースHossii">
              {HOSSII_BASIC_PRESETS.map((preset) => {
                const isSelected = draft.baseKey === preset.key;
                return (
                  <button
                    key={preset.key}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    className={`${styles.baseOption} ${isSelected ? styles.baseOptionSelected : ''}`}
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        baseKey: preset.key,
                      }))
                    }
                  >
                    <img src={preset.imagePath} alt="" aria-hidden className={styles.baseImage} />
                    <span className={styles.baseLabel}>{preset.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className={styles.partsSection} aria-label="パーツ（準備中）">
            <h3 className={styles.sectionTitle}>パーツ</h3>
            <ul className={styles.partsList}>
              {(Object.keys(PART_LABELS) as Array<keyof typeof PART_LABELS>).map((key) => (
                <li key={key} className={styles.partRow}>
                  <span className={styles.partLabel}>{PART_LABELS[key]}</span>
                  <span className={styles.partStatus}>
                    Coming soon
                    <span className={styles.partBadge}>準備中</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className={styles.partsNote}>
              目・口・模様・アクセサリーの画像が揃い次第、ここから組み合わせできるようになります。
            </p>
          </section>
        </div>

        <footer className={styles.footer}>
          {error && (
            <p className={styles.errorMessage} role="alert">
              {error}
            </p>
          )}
          <div className={styles.footerActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={handleRestorePreset}
              disabled={isSaving}
            >
              初期状態に戻す
            </button>
            <button type="button" className={styles.cancelButton} onClick={onClose} disabled={isSaving}>
              キャンセル
            </button>
            <button
              type="button"
              className={styles.saveButton}
              onClick={() => void handleSave()}
              disabled={isSaving}
              aria-busy={isSaving}
            >
              {isSaving ? '保存中...' : 'カスタムを保存'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
