import { useCallback, useEffect, useState } from 'react';
import styles from './SpaceWelcomeBanner.module.css';
import {
  loadWelcomeBannerDismissed,
  saveWelcomeBannerDismissed,
} from './spaceWelcomeBannerStorage';

const HOSSII_IDLE_SMILE = '/hossii/idle/idle_smile.png';

type Props = {
  spaceId: string;
  spaceName?: string;
  /** スペースPaneBar表示時は上部オフセットを広げる */
  withPaneBar?: boolean;
  characterImageUrl?: string;
  onPostClick?: () => void;
  onDismiss?: () => void;
  /** false にすると localStorage を無視して常に表示（デモ用） */
  respectDismissStorage?: boolean;
};

function buildWelcomeCopy(spaceName: string) {
  return {
    title: `${spaceName}へようこそ！`,
    message: '気持ちを星にのせて、みんなとつながってみよう。タップして最初のHossiiを届けてね。',
  };
}

export function SpaceWelcomeBanner({
  spaceId,
  spaceName = 'このスペース',
  withPaneBar = false,
  characterImageUrl,
  onPostClick,
  onDismiss,
  respectDismissStorage = true,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (respectDismissStorage && loadWelcomeBannerDismissed(spaceId)) {
      return;
    }
    setVisible(true);
  }, [spaceId, respectDismissStorage]);

  const dismiss = useCallback(() => {
    setExiting(true);
    window.setTimeout(() => {
      if (respectDismissStorage) {
        saveWelcomeBannerDismissed(spaceId);
      }
      setVisible(false);
      onDismiss?.();
    }, 280);
  }, [spaceId, onDismiss, respectDismissStorage]);

  const handlePostClick = useCallback(() => {
    onPostClick?.();
    dismiss();
  }, [dismiss, onPostClick]);

  if (!visible) {
    return null;
  }

  const copy = buildWelcomeCopy(spaceName);

  return (
    <div
      className={[
        styles.banner,
        withPaneBar ? styles.bannerWithPaneBar : '',
        exiting ? styles.bannerExiting : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="region"
      aria-label="初めての方への案内"
      data-space-export="exclude"
    >
      <div className={styles.avatarWrap}>
        <div className={styles.avatarRing}>
          <img
            src={characterImageUrl ?? HOSSII_IDLE_SMILE}
            alt=""
            className={styles.avatar}
            aria-hidden
          />
        </div>
        <span className={styles.sparkle} aria-hidden>
          ✨
        </span>
      </div>

      <div className={styles.content}>
        <p className={styles.title}>{copy.title}</p>
        <p className={styles.message}>{copy.message}</p>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={handlePostClick}
        >
          投稿してみる
        </button>
        <button
          type="button"
          className={styles.dismissButton}
          onClick={dismiss}
          aria-label="案内を閉じる"
        >
          ×
        </button>
      </div>
    </div>
  );
}
