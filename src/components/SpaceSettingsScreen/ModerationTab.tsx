import { useState, useMemo } from 'react';
import { Eye, EyeOff, Search } from 'lucide-react';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { useAuth } from '../../core/contexts/AuthContext';
import styles from './ModerationTab.module.css';

type FilterMode = 'visible' | 'hidden' | 'all';

type Props = {
  spaceId: string;
};

export const ModerationTab = ({ spaceId }: Props) => {
  const { state, hideHossii, restoreHossii } = useHossiiStore();
  const { currentUser } = useAuth();
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [keyword, setKeyword] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const spaceHossiis = useMemo(
    () => state.hossiis.filter((h) => h.spaceId === spaceId),
    [state.hossiis, spaceId]
  );

  const filtered = useMemo(() => {
    return spaceHossiis
      .filter((h) => {
        if (filterMode === 'visible' && h.isHidden) return false;
        if (filterMode === 'hidden' && !h.isHidden) return false;
        if (keyword) {
          const kw = keyword.toLowerCase();
          const matchMessage = h.message?.toLowerCase().includes(kw);
          const matchAuthor = h.authorName?.toLowerCase().includes(kw);
          if (!matchMessage && !matchAuthor) return false;
        }
        if (dateFrom) {
          const from = new Date(dateFrom);
          if (h.createdAt < from) return false;
        }
        if (dateTo) {
          const to = new Date(dateTo);
          to.setHours(23, 59, 59, 999);
          if (h.createdAt > to) return false;
        }
        return true;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [spaceHossiis, filterMode, keyword, dateFrom, dateTo]);

  const handleHide = (id: string) => {
    if (!window.confirm('この投稿を非表示にしますか？')) return;
    hideHossii(id, currentUser?.uid ?? undefined);
  };

  const handleRestore = (id: string) => {
    restoreHossii(id, currentUser?.uid ?? undefined);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>モデレーション</h2>
      <p className={styles.description}>
        スペース内の投稿を確認し、不適切な投稿を非表示にできます。
      </p>

      {/* フィルターバー */}
      <div className={styles.filterBar}>
        <div className={styles.segmentGroup}>
          {(['all', 'visible', 'hidden'] as FilterMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`${styles.segmentButton} ${filterMode === mode ? styles.segmentActive : ''}`}
              onClick={() => setFilterMode(mode)}
            >
              {mode === 'all' ? '全件' : mode === 'visible' ? '表示中' : '非表示'}
            </button>
          ))}
        </div>

        <div className={styles.searchRow}>
          <div className={styles.searchInputWrapper}>
            <Search size={14} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="投稿者名・キーワードで検索"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <input
            type="date"
            className={styles.dateInput}
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            title="開始日"
          />
          <span className={styles.dateSep}>〜</span>
          <input
            type="date"
            className={styles.dateInput}
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            title="終了日"
          />
        </div>
      </div>

      {/* 投稿一覧 */}
      <div className={styles.tableWrapper}>
        {filtered.length === 0 ? (
          <div className={styles.empty}>該当する投稿がありません</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>投稿日時</th>
                <th className={styles.th}>投稿者</th>
                <th className={styles.th}>メッセージ</th>
                <th className={styles.th}>状態</th>
                <th className={styles.th}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((hossii) => (
                <tr
                  key={hossii.id}
                  className={`${styles.tr} ${hossii.isHidden ? styles.hiddenRow : ''}`}
                >
                  <td className={styles.td}>{formatDate(hossii.createdAt)}</td>
                  <td className={styles.td}>
                    <span className={styles.authorName}>
                      {hossii.authorName ?? '匿名'}
                    </span>
                  </td>
                  <td className={styles.tdMessage}>
                    <span
                      className={styles.messageText}
                      title={hossii.message}
                    >
                      {hossii.message
                        ? hossii.message.slice(0, 60) + (hossii.message.length > 60 ? '…' : '')
                        : <span className={styles.noMessage}>(メッセージなし)</span>
                      }
                    </span>
                  </td>
                  <td className={styles.td}>
                    {hossii.isHidden ? (
                      <span className={styles.badgeHidden}>非表示</span>
                    ) : (
                      <span className={styles.badgeVisible}>表示中</span>
                    )}
                  </td>
                  <td className={styles.td}>
                    {hossii.isHidden ? (
                      <button
                        type="button"
                        className={styles.restoreButton}
                        onClick={() => handleRestore(hossii.id)}
                        title="復元する"
                      >
                        <Eye size={14} />
                        復元
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={styles.hideButton}
                        onClick={() => handleHide(hossii.id)}
                        title="非表示にする"
                      >
                        <EyeOff size={14} />
                        非表示
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className={styles.count}>
        {filtered.length} 件表示 / 合計 {spaceHossiis.length} 件
      </p>
    </div>
  );
};
