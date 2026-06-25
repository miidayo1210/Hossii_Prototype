import { Info } from 'lucide-react';
import styles from './SpaceDescriptionPanel.module.css';

type Props = {
  description: string;
};

export function SpaceDescriptionPanel({ description }: Props) {
  return (
    <div
      className={styles.panel}
      data-space-export="exclude"
      aria-label="スペースの説明"
      title={description}
    >
      <Info size={14} className={styles.icon} aria-hidden />
      <span className={styles.text}>{description}</span>
    </div>
  );
}
