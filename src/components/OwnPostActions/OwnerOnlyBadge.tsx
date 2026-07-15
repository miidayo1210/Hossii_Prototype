import { EyeOff } from 'lucide-react';
import styles from './OwnPostActions.module.css';

/**
 * Phase 2D-2: owner_only（自分だけ）投稿であることを示す小さなバッジ。
 * 本人以外・ゲストは RLS により owner_only 投稿を取得しないため、このバッジは本人にしか出ない。
 */
export const OwnerOnlyBadge = () => (
  <span className={styles.ownerOnlyBadge} title="この投稿はあなただけに表示されています">
    <EyeOff size={11} />
    自分だけ
  </span>
);
