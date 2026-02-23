import { useState, useEffect, useRef } from 'react';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { useRouter } from '../../core/hooks/useRouter';
import { TopRightMenu } from '../Navigation/TopRightMenu';
import { BackgroundSelector } from '../BackgroundSelector/BackgroundSelector';
import { generateId } from '../../core/utils';
import type { Space, CardType, SpaceBackground } from '../../core/types/space';
import { DEFAULT_QUICK_EMOTIONS } from '../../core/types/space';
import styles from './SpacesScreen.module.css';

export const SpacesScreen = () => {
  const { state, addSpace, updateSpace, removeSpace, setActiveSpace } = useHossiiStore();
  const { navigate } = useRouter();
  const { spaces, activeSpaceId } = state;

  // 新規作成フォーム
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceCardType, setNewSpaceCardType] = useState<CardType>('constellation');

  // ID で追加フォーム
  const [addById, setAddById] = useState('');

  // コピー完了表示（'link' or 'id'）
  const [copiedState, setCopiedState] = useState<{ spaceId: string; type: 'link' | 'id' } | null>(null);

  // 背景編集中のスペースID
  const [editingBgSpaceId, setEditingBgSpaceId] = useState<string | null>(null);

  // 作成された objectURL を追跡（クリーンアップ用）
  const objectURLsRef = useRef<Set<string>>(new Set());

  // コンポーネントアンマウント時に全ての objectURL を解放
  useEffect(() => {
    return () => {
      objectURLsRef.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      objectURLsRef.current.clear();
    };
  }, []);

  // ID を短縮表示（先頭6 + 末尾4）
  const shortenId = (id: string) => {
    if (id.length <= 12) return id;
    return `${id.slice(0, 6)}...${id.slice(-4)}`;
  };

  // スペースを開く
  const handleOpenSpace = (spaceId: string) => {
    setActiveSpace(spaceId);
    navigate('screen');
  };

  // 新しいスペースを作成
  const handleCreateSpace = () => {
    const trimmedName = newSpaceName.trim();
    if (!trimmedName) return;

    const newSpace: Space = {
      id: generateId(),
      name: trimmedName,
      cardType: newSpaceCardType,
      quickEmotions: DEFAULT_QUICK_EMOTIONS,
      createdAt: new Date(),
    };

    addSpace(newSpace);
    setNewSpaceName('');
    setNewSpaceCardType('constellation');
  };

  // ID でスペースを追加
  const handleAddById = () => {
    const trimmedId = addById.trim();
    if (!trimmedId) return;

    // すでに存在するかチェック
    if (spaces.find((f) => f.id === trimmedId)) {
      alert('このスペースはすでに追加されています');
      return;
    }

    // 仮のスペースを作成（実際には同期用だが、デモでは新規作成扱い）
    const newSpace: Space = {
      id: trimmedId,
      name: `共有されたスペース (${trimmedId.slice(0, 8)})`,
      cardType: 'constellation',
      quickEmotions: DEFAULT_QUICK_EMOTIONS,
      createdAt: new Date(),
    };

    addSpace(newSpace);
    setAddById('');
  };

  // 共有リンクをコピー（?space=<id> を含む）
  const handleCopyLink = (spaceId: string) => {
    const url = `${window.location.origin}${window.location.pathname}?space=${spaceId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedState({ spaceId, type: 'link' });
      setTimeout(() => setCopiedState(null), 2000);
    });
  };

  // IDをコピー
  const handleCopyId = (spaceId: string) => {
    navigator.clipboard.writeText(spaceId).then(() => {
      setCopiedState({ spaceId, type: 'id' });
      setTimeout(() => setCopiedState(null), 2000);
    });
  };

  // 背景を更新
  const handleBackgroundSelect = (spaceId: string, background: SpaceBackground) => {
    // 新しい背景が一時画像の場合、追跡リストに追加
    if (background.kind === 'image' && background.source === 'temp') {
      objectURLsRef.current.add(background.value);
    }

    updateSpace(spaceId, { background });
  };

  // objectURL を解放
  const handleImageURLRevoke = (url: string) => {
    URL.revokeObjectURL(url);
    objectURLsRef.current.delete(url);
  };

  // スペースを削除
  const handleDeleteSpace = (space: Space) => {
    const confirmed = window.confirm(
      `「${space.name}」を削除しますか？\nこの操作は取り消せません。`
    );
    if (confirmed) {
      removeSpace(space.id);
    }
  };

  return (
    <div className={styles.container}>
      <TopRightMenu />

      {/* ヘッダー */}
      <header className={styles.header}>
        <h1 className={styles.title}>スペース管理</h1>
        <p className={styles.subtitle}>スペースを作成・切り替えできます</p>
      </header>

      {/* メインコンテンツ */}
      <main className={styles.main}>
        {/* スペース一覧 */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>あなたのスペース</h2>
          <div className={styles.spaceList}>
            {spaces.map((space) => (
              <div
                key={space.id}
                className={`${styles.spaceCard} ${
                  space.id === activeSpaceId ? styles.spaceCardActive : ''
                }`}
              >
                <div className={styles.spaceCardMain}>
                  <div className={styles.spaceInfo}>
                    <div className={styles.spaceName}>{space.name}</div>
                    <div className={styles.spaceMeta}>
                      {space.cardType === 'stamp' ? 'スタンプ' : '星座'}
                      {space.id === activeSpaceId && (
                        <span className={styles.activeBadge}>現在のスペース</span>
                      )}
                    </div>
                    <div className={styles.spaceId}>
                      <span className={styles.spaceIdLabel}>ID:</span>
                      <code className={styles.spaceIdValue}>{shortenId(space.id)}</code>
                    </div>
                  </div>
                  <div className={styles.spaceActions}>
                  <button
                    type="button"
                    className={styles.bgButton}
                    onClick={() => setEditingBgSpaceId(
                      editingBgSpaceId === space.id ? null : space.id
                    )}
                  >
                    {editingBgSpaceId === space.id ? '閉じる' : '背景'}
                  </button>
                  <button
                    type="button"
                    className={styles.idCopyButton}
                    onClick={() => handleCopyId(space.id)}
                  >
                    {copiedState?.spaceId === space.id && copiedState.type === 'id'
                      ? 'コピー!'
                      : 'IDコピー'}
                  </button>
                  <button
                    type="button"
                    className={styles.copyButton}
                    onClick={() => handleCopyLink(space.id)}
                    title={`?space=${space.id} を含むリンク`}
                  >
                    {copiedState?.spaceId === space.id && copiedState.type === 'link'
                      ? 'コピー!'
                      : '招待リンク'}
                  </button>
                  {space.id !== activeSpaceId && (
                    <button
                      type="button"
                      className={styles.openButton}
                      onClick={() => handleOpenSpace(space.id)}
                    >
                      このスペースを開く
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.deleteButton}
                    onClick={() => handleDeleteSpace(space)}
                  >
                    🗑 削除
                  </button>
                  </div>
                </div>

                {/* 背景セレクター */}
                {editingBgSpaceId === space.id && (
                  <div className={styles.bgSelectorContainer}>
                    <BackgroundSelector
                      currentBackground={space.background}
                      onSelect={(bg) => handleBackgroundSelect(space.id, bg)}
                      onImageURLRevoke={handleImageURLRevoke}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* 新規作成フォーム */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>新しいスペースを作る</h2>
          <div className={styles.form}>
            <div className={styles.formRow}>
              <label className={styles.label}>スペースの名前</label>
              <input
                type="text"
                className={styles.input}
                placeholder="例: チームのスペース"
                value={newSpaceName}
                onChange={(e) => setNewSpaceName(e.target.value)}
              />
            </div>
            <div className={styles.formRow}>
              <label className={styles.label}>カードタイプ</label>
              <div className={styles.radioGroup}>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="cardType"
                    checked={newSpaceCardType === 'constellation'}
                    onChange={() => setNewSpaceCardType('constellation')}
                  />
                  星座
                </label>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="cardType"
                    checked={newSpaceCardType === 'stamp'}
                    onChange={() => setNewSpaceCardType('stamp')}
                  />
                  スタンプ
                </label>
              </div>
            </div>
            <button
              type="button"
              className={styles.createButton}
              onClick={handleCreateSpace}
              disabled={!newSpaceName.trim()}
            >
              作成する
            </button>
          </div>
        </section>

        {/* ID で追加フォーム */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>スペースを追加（IDで）</h2>
          <p className={styles.sectionDescription}>
            共有されたスペースのIDを入力して追加できます
          </p>
          <div className={styles.form}>
            <div className={styles.formRow}>
              <input
                type="text"
                className={styles.input}
                placeholder="スペースのIDを入力"
                value={addById}
                onChange={(e) => setAddById(e.target.value)}
              />
            </div>
            <button
              type="button"
              className={styles.addButton}
              onClick={handleAddById}
              disabled={!addById.trim()}
            >
              追加する
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};
