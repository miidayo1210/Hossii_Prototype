import { useState, useRef, useCallback } from 'react';
import styles from './Tooltip.module.css';

type Props = {
  text: string;
  children: React.ReactNode;
  /** ツールチップを右に出すか左に出すか（デフォルト: right） */
  side?: 'right' | 'left';
};

const TOOLTIP_DELAY_MS = 400;

export const Tooltip = ({ text, children, side = 'right' }: Props) => {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => setVisible(true), TOOLTIP_DELAY_MS);
  }, []);

  const hide = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
  }, []);

  return (
    <div
      className={styles.wrapper}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <div
          className={`${styles.tooltip} ${side === 'left' ? styles.tooltipLeft : styles.tooltipRight}`}
          role="tooltip"
        >
          {text}
        </div>
      )}
    </div>
  );
};
