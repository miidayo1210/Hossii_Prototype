import { useState } from 'react';
import { Plus, X, Tag } from 'lucide-react';
import type { Space } from '../../core/types/space';
import { SettingsPageHeader } from './SettingsPageHeader';
import sharedStyles from './SettingsShared.module.css';
import styles from './TagsTab.module.css';

type Props = {
  space: Space;
  onUpdateSpace: (patch: Partial<Space>) => void;
};

const MAX_TAG_LENGTH = 20;
const MAX_TAGS = 20;

function normalizeTag(input: string): string {
  // 先頭の # を取り除き、空白を除去
  return input.trim().replace(/^#+/, '');
}

export const TagsTab = ({ space, onUpdateSpace }: Props) => {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const tags: string[] = space.presetTags ?? [];

  const addTag = () => {
    const normalized = normalizeTag(input);
    if (!normalized) return;

    if (normalized.length > MAX_TAG_LENGTH) {
      setError(`タグ名は ${MAX_TAG_LENGTH} 文字以内で入力してください`);
      return;
    }
    if (tags.length >= MAX_TAGS) {
      setError(`タグは最大 ${MAX_TAGS} 件まで登録できます`);
      return;
    }
    const tagWithHash = `#${normalized}`;
    const isDuplicate = tags.some(
      (t) => t.toLowerCase() === tagWithHash.toLowerCase()
    );
    if (isDuplicate) {
      setError('同じタグがすでに登録されています');
      return;
    }

    setError(null);
    onUpdateSpace({ presetTags: [...tags, tagWithHash] });
    setInput('');
    setToast('タグを追加しました');
    setTimeout(() => setToast(null), 3000);
  };

  const removeTag = (tag: string) => {
    onUpdateSpace({ presetTags: tags.filter((t) => t !== tag) });
    setToast('タグを削除しました');
    setTimeout(() => setToast(null), 3000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <>
      <SettingsPageHeader
        title="タグ"
        description="投稿時にワンタップで選択できるタグを登録できます。登録したタグはログ一覧のフィルタリングにも使用できます。"
      >
      <div className={styles.inputSection}>
        <div className={styles.inputRow}>
          <span className={styles.hashPrefix}>#</span>
          <input
            type="text"
            className={styles.input}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="タグ名を入力（例: 質問）"
            maxLength={MAX_TAG_LENGTH + 1}
          />
          <button
            type="button"
            className={styles.addButton}
            onClick={addTag}
            disabled={!input.trim()}
          >
            <Plus size={16} />
            追加
          </button>
        </div>
        {error && <p className={styles.error}>{error}</p>}
        <p className={styles.hint}>
          Enter キーまたは「追加」ボタンで確定。{tags.length} / {MAX_TAGS} 件
        </p>
      </div>

      {tags.length > 0 ? (
        <div className={styles.tagList}>
          {tags.map((tag) => (
            <span key={tag} className={styles.tagChip}>
              <Tag size={12} className={styles.tagIcon} />
              {tag}
              <button
                type="button"
                className={styles.removeButton}
                onClick={() => removeTag(tag)}
                aria-label={`${tag} を削除`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className={styles.emptyText}>登録済みのタグはありません</p>
      )}
      </SettingsPageHeader>

      {toast && <div className={`${sharedStyles.toast} ${sharedStyles.toastSuccess}`}>{toast}</div>}
    </>
  );
};
