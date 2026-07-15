import styles from './PostedNameLabel.module.css';

type Props = {
  /** 投稿時の旧ニックネーム。null のときは何も描画しない */
  name: string | null | undefined;
  className?: string;
};

/**
 * 「投稿時：旧ニックネーム」を投稿本文より弱い表示で補足するラベル（Phase 2C）。
 * 現在名と投稿時名が異なる場合にのみ表示する（resolvePostAuthorDisplay の postedNameLabel を渡す）。
 */
export function PostedNameLabel({ name, className }: Props) {
  if (!name) return null;
  return (
    <span className={`${styles.postedName}${className ? ` ${className}` : ''}`}>
      投稿時：{name}
    </span>
  );
}
