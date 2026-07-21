import { useState } from 'react';
import { HOSSII_IDLE } from '../../core/assets/hossiiIdle';
import styles from './SpaceWelcomeGuide.module.css';

const HOSSII_HAPPY = '/hossii/emotion/happy.png';

const DEFAULT_BODY = `ここでは、
感じたことや気づいたことを
自由に投稿してみてね。`;

export const SPACE_WELCOME_PRIVACY_NOTICE_TEXT =
  '投稿には、氏名・住所・電話番号・メールアドレスなど、個人を特定できる情報を書かないでください。';

type Props = {
  nickname: string;
  description?: string;
  interactionHint: string;
  onClose: () => void;
};

export function SpaceWelcomeGuide({ nickname, description, interactionHint, onClose }: Props) {
  const [hossiiSrc, setHossiiSrc] = useState(HOSSII_HAPPY);
  const trimmedNickname = nickname.trim();
  const welcomeLine = trimmedNickname ? `${trimmedNickname}さん、ようこそ！` : 'ようこそ！';
  const bodyText = description?.trim() ? description.trim() : DEFAULT_BODY;

  return (
    <div className={styles.anchor} data-space-export="exclude" role="dialog" aria-modal="false" aria-labelledby="space-welcome-guide-title">
      <div className={styles.card}>
        <div className={styles.hossiiArea}>
          <img
            src={hossiiSrc}
            alt="Hossii"
            className={styles.hossiiImage}
            onError={() => {
              if (hossiiSrc !== HOSSII_IDLE.smile) {
                setHossiiSrc(HOSSII_IDLE.smile);
              }
            }}
          />
        </div>

        <p id="space-welcome-guide-title" className={styles.welcomeLine}>
          {welcomeLine}
        </p>

        <p className={styles.bodyText}>{bodyText}</p>

        <p className={styles.privacyNotice} role="note" aria-live="off">
          {SPACE_WELCOME_PRIVACY_NOTICE_TEXT}
        </p>

        <p className={styles.interactionHint}>{interactionHint}</p>

        <button type="button" className={styles.primaryButton} onClick={onClose}>
          わかった
        </button>
      </div>
    </div>
  );
}
