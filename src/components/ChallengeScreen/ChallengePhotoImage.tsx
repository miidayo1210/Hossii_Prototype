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
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const path = photoPath.trim();
    if (!path) {
      setSignedUrl(null);
      setFailed(true);
      return;
    }
    setFailed(false);
    setSignedUrl(null);
    void createChallengePhotoSignedUrl(path).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setSignedUrl(result.signedUrl);
        setFailed(false);
      } else {
        setSignedUrl(null);
        setFailed(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [photoPath]);

  const sizeClass =
    size === 'sm' ? styles.sizeSm : size === 'lg' ? styles.sizeLg : styles.sizeMd;

  if (failed) {
    return (
      <p className={`${styles.fallback} ${className ?? ''}`.trim()} role="status">
        写真を表示できません
      </p>
    );
  }

  if (!signedUrl) {
    return (
      <p className={`${styles.loading} ${className ?? ''}`.trim()} role="status">
        写真を読み込み中…
      </p>
    );
  }

  return (
    <img
      src={signedUrl}
      alt={alt}
      className={`${styles.image} ${sizeClass} ${className ?? ''}`.trim()}
      loading="lazy"
    />
  );
}
