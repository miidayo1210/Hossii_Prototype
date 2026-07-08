import styles from './ActiveSpaceUnavailableBanner.module.css';

type Props = {
  message: string;
  hint?: string;
};

export function ActiveSpaceUnavailableBanner({ message, hint }: Props) {
  return (
    <div className={styles.banner} role="alert">
      <p className={styles.message}>{message}</p>
      {hint ? <p className={styles.hint}>{hint}</p> : null}
    </div>
  );
}
