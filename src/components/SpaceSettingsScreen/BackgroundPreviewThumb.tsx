import { useMemo, type CSSProperties } from 'react';
import type { SpaceBackground } from '../../core/types/space';
import bgStyles from '../../styles/spaceBackgrounds.module.css';
import styles from './BackgroundPreviewThumb.module.css';

const IMAGE_LETTERBOX = '#0f172a';

type Props = {
  background?: SpaceBackground;
  label?: string;
};

export function BackgroundPreviewThumb({ background, label }: Props) {
  const { className, style, imageUrl } = useMemo(() => {
    if (!background) {
      return {
        className: `${bgStyles.bgBase} ${bgStyles.pattern_mist}`,
        style: {} as CSSProperties,
        imageUrl: null as string | null,
      };
    }

    if (background.kind === 'color') {
      return {
        className: bgStyles.bgBase,
        style: { backgroundColor: background.value },
        imageUrl: null as string | null,
      };
    }

    if (background.kind === 'pattern') {
      const patternClass = bgStyles[`pattern_${background.value}`] || bgStyles.pattern_mist;
      return {
        className: `${bgStyles.bgBase} ${patternClass}`,
        style: {},
        imageUrl: null as string | null,
      };
    }

    if (background.kind === 'image') {
      return {
        className: bgStyles.bgBase,
        style: { backgroundColor: IMAGE_LETTERBOX },
        imageUrl: background.value,
      };
    }

    return {
      className: `${bgStyles.bgBase} ${bgStyles.pattern_mist}`,
      style: {},
      imageUrl: null as string | null,
    };
  }, [background]);

  return (
    <div className={styles.preview} aria-label={label} role="img">
      <div className={`${styles.thumb} ${className}`} style={style}>
        {imageUrl && <img src={imageUrl} alt="" className={styles.img} />}
      </div>
    </div>
  );
}
