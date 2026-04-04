import { useState, useEffect } from 'react';
import { useAuth } from '../../core/contexts/useAuth';
import { useFeatureFlags, invalidateFeatureFlagsCache } from '../../core/hooks/useFeatureFlags';
import { setSpaceFeatureFlag, type FeatureFlagKey, type FeatureFlags } from '../../core/utils/featureFlagsApi';
import styles from './FeatureFlagsTab.module.css';

type Props = {
  spaceId: string;
};

type FlagMeta = {
  key: FeatureFlagKey;
  label: string;
  description: string;
};

const FLAG_LIST: FlagMeta[] = [
  {
    key: 'comments_thumbnail',
    label: '画像サムネイル表示',
    description: 'コメント一覧で画像投稿をサムネイルとして表示します。OFFにするとリンク表示になります。',
  },
  {
    key: 'random_recall_enabled',
    label: 'ランダム想起',
    description: '内省スペースで7日以上前の投稿をランダムに表示します。セレンディピティ体験の核心機能。',
  },
  {
    key: 'public_board_mode',
    label: '公開ボードモード',
    description: 'ONにするとスペースを公開ボードとして運用できます。内省スペースでは通常OFF。',
  },
  {
    key: 'zine_export_enabled',
    label: 'ZINE出力',
    description: '月次の振り返りレポートをPDFで出力します（実装予定）。',
  },
  {
    key: 'bubble_shapes_extended',
    label: '吹き出し形状カスタマイズ',
    description: '投稿ごとに吹き出しの形を選択できるようにします。',
  },
];

export const FeatureFlagsTab = ({ spaceId }: Props) => {
  const { currentUser } = useAuth();
  const { flags } = useFeatureFlags(spaceId);

  // 楽観的更新のためローカルコピーを保持
  const [localFlags, setLocalFlags] = useState<FeatureFlags>(flags);
  const [saving, setSaving] = useState<FeatureFlagKey | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // hook から取得したフラグが変わったらローカルに同期
  useEffect(() => {
    setLocalFlags(flags);
  }, [flags]);

  // トーストを3秒で自動消去
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleToggle = (key: FeatureFlagKey, currentValue: boolean) => {
    if (saving) return;

    // 楽観的更新
    setLocalFlags((prev) => ({ ...prev, [key]: !currentValue }));
    setSaving(key);

    setSpaceFeatureFlag(spaceId, key, !currentValue, currentUser?.uid)
      .then(() => {
        invalidateFeatureFlagsCache(spaceId);
        const label = FLAG_LIST.find((f) => f.key === key)?.label ?? key;
        setToast({ message: `「${label}」を${!currentValue ? 'ON' : 'OFF'}にしました`, type: 'success' });
      })
      .catch((err) => {
        console.error('[FeatureFlagsTab] toggle failed', err);
        // 失敗時は元の値に戻す
        setLocalFlags((prev) => ({ ...prev, [key]: currentValue }));
        setToast({ message: '設定の保存に失敗しました', type: 'error' });
      })
      .finally(() => {
        setSaving(null);
      });
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Feature Flags</h2>
      <p className={styles.description}>
        このスペース固有の機能フラグをON/OFFできます。変更は即座に反映されます。
      </p>

      <div className={styles.flagList}>
        {FLAG_LIST.map((flag) => {
          const enabled = localFlags[flag.key];
          const isSaving = saving === flag.key;
          return (
            <div key={flag.key} className={styles.flagItem}>
              <div className={styles.flagInfo}>
                <span className={styles.flagLabel}>{flag.label}</span>
                <span className={styles.flagDescription}>{flag.description}</span>
                <span className={styles.flagKey}>{flag.key}</span>
              </div>
              <label className={styles.toggleWrapper}>
                <input
                  type="checkbox"
                  className={styles.toggleInput}
                  checked={enabled}
                  disabled={isSaving}
                  onChange={() => handleToggle(flag.key, enabled)}
                  aria-label={`${flag.label}を${enabled ? 'OFF' : 'ON'}にする`}
                />
                <span className={`${styles.toggleSlider} ${isSaving ? styles.saving : ''}`} />
              </label>
            </div>
          );
        })}
      </div>

      {toast && (
        <div className={`${styles.toast} ${styles[toast.type]}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
};
