/**
 * HossiiSendButton - 送信ボタンコンポーネント
 * 旧Leapday HossiiSendButton.tsx から移植
 */

import styles from './HossiiSendButton.module.css';

type Props = {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** 喜びモード（送信直後に一瞬trueにする） */
  happy?: boolean;
  children?: React.ReactNode;
};

export function HossiiSendButton({
  onClick,
  disabled,
  loading,
  happy,
  children,
}: Props) {
  const isDisabled = disabled || loading;

  const handleClick = () => {
    if (isDisabled) return;
    onClick();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDisabled}
      className={`${styles.button} ${isDisabled ? styles.disabled : ''}`}
    >
      {/* 左にHossiiアイコン */}
      <span className={`${styles.icon} ${happy ? 'hossii-soft-bounce' : ''}`}>
        {happy ? '🙌' : '🌟'}
      </span>

      {/* 右側のテキスト部分 */}
      {loading ? (
        <span className={styles.loading}>
          <span>送信中</span>
          <span className={styles.dots}>
            <span className={`${styles.dot} hossii-dot`} />
            <span className={`${styles.dot} hossii-dot`} style={{ animationDelay: '120ms' }} />
            <span className={`${styles.dot} hossii-dot`} style={{ animationDelay: '240ms' }} />
          </span>
        </span>
      ) : (
        <span className={styles.label}>{children || 'Hossii に送る！'}</span>
      )}
    </button>
  );
}
