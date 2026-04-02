import { useRef, useEffect } from 'react';
import type { Space } from '../../core/types/space';
import { BackgroundSelector } from '../BackgroundSelector/BackgroundSelector';
import styles from './BackgroundTab.module.css';

type Props = {
  space: Space;
  onUpdateSpace: (patch: Partial<Space>) => void;
};

export const BackgroundTab = ({ space, onUpdateSpace }: Props) => {
  const objectURLsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const urls = objectURLsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const handleSelect = (background: Space['background']) => {
    if (background?.kind === 'image' && background.source === 'temp') {
      objectURLsRef.current.add(background.value);
    }
    onUpdateSpace({ background });
  };

  const handleImageURLRevoke = (url: string) => {
    URL.revokeObjectURL(url);
    objectURLsRef.current.delete(url);
  };

  return (
    <div className={styles.container}>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>背景設定</h2>
        <p className={styles.description}>
          スペースの背景デザインを選択してください
        </p>
        <BackgroundSelector
          currentBackground={space.background}
          onSelect={handleSelect}
          onImageURLRevoke={handleImageURLRevoke}
          spaceId={space.id}
          savedBackgroundImages={space.savedBackgroundImages}
          onUpdateSavedImages={(urls) => onUpdateSpace({ savedBackgroundImages: urls })}
        />
      </section>
    </div>
  );
};
