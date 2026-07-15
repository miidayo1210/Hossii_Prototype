import styles from './PostScreen.module.css';

type PostFieldLabelProps = {
  label: string;
  required: boolean;
  id?: string;
};

/** 投稿フォーム項目名 + 必須/任意バッジ（管理者 postFields 設定に連動） */
export function PostFieldLabel({ label, required, id }: PostFieldLabelProps) {
  return (
    <div className={styles.labelRow}>
      <div className={styles.label} id={id}>
        {label}
      </div>
      <span className={required ? styles.requiredBadge : styles.optionalBadge}>
        {required ? '必須' : '任意'}
      </span>
    </div>
  );
}
