import { useEffect, useState } from 'react';
import { createChallengePhotoSignedUrl } from '../../core/utils/challengePhotoStorageApi';
import styles from './ChallengePhotoImage.module.css';

type Props = {
  photoPath: string;
  alt?: string;
  className?: string;
  /** Compact thumbnail for excerpts / lists. */
  size?: 'sm' | 'md' | 'lg';
};

type LoadState = {
  path: string;
  signedUrl: string | null;
  failed: boolean;
};

/**
 * Loads a short-lived signed URL for a private challenge photo.
 * Authorization is Storage RLS (same as response visibility).
 */
export function ChallengePhotoImage({
  photoPath,
  alt = '回答写真',
  className,
  size = 'md',
}: Props) {
  const path = photoPath.trim();
  const [loaded, setLoaded] = useState<LoadState | null>(null);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    void createChallengePhotoSignedUrl(path).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setLoaded({ path, signedUrl: result.signedUrl, failed: false });
      } else {
        setLoaded({ path, signedUrl: null, failed: true });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  const sizeClass =
    size === 'sm' ? styles.sizeSm : size === 'lg' ? styles.sizeLg : styles.sizeMd;
  const current = loaded?.path === path ? loaded : null;

  if (!path) {
    return (
      <p className={`${styles.fallback} ${className ?? ''}`.trim()} role="status">
        写真を表示できません
      </p>
    );
  }

  if (!current) {
    return (
      <p className={`${styles.loading} ${className ?? ''}`.trim()} role="status">
        写真を読み込み中…
      </p>
    );
  }

  if (current.failed || !current.signedUrl) {
    return (
      <p className={`${styles.fallback} ${className ?? ''}`.trim()} role="status">
        写真を表示できません
      </p>
    );
  }

  return (
    <img
      src={current.signedUrl}
      alt={alt}
      className={`${styles.image} ${sizeClass} ${className ?? ''}`.trim()}
      loading="lazy"
    />
  );
}
