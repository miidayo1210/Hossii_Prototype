import styles from './PostPrivacyNotice.module.css';

export const POST_PRIVACY_NOTICE_TEXT =
  '安心して使うために、名前・住所・連絡先などの個人情報は、できるだけ投稿しないでね。';

export function PostPrivacyNotice() {
  return (
    <p className={styles.notice} role="note" aria-live="off">
      {POST_PRIVACY_NOTICE_TEXT}
    </p>
  );
}
