import type { CSSProperties, ReactNode } from 'react';
import { useDisplayPrefs } from '../../core/contexts/DisplayPrefsContext';
import styles from './ScaledContent.module.css';

type Props = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

/**
 * 表示倍率を子ツリーにだけ適用する。position:fixed のパネルをズーム外に置くために使用する。
 */
export function ScaledContent({ children, className, style }: Props) {
  const {
    prefs: { displayScale },
  } = useDisplayPrefs();

  return (
    <div
      className={`${styles.scaled} ${className ?? ''}`}
      data-scale={String(displayScale)}
      style={style}
    >
      {children}
    </div>
  );
}
