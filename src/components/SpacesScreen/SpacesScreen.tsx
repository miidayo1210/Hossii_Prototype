import { useState, useEffect, useRef } from 'react';
import { Pencil, Check, X, Settings, ChevronLeft } from 'lucide-react';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { useRouter } from '../../core/hooks/useRouter';
import { useAuth } from '../../core/contexts/AuthContext';
import { useAdminNavigation } from '../../core/contexts/AdminNavigationContext';
import { BackgroundSelector } from '../BackgroundSelector/BackgroundSelector';
import { generateId } from '../../core/utils';
import { generateSpaceURL, validateSpaceURL, isSpaceURLUnique } from '../../core/utils/spaceUrlUtils';
import { updateCommunitySlug, fetchCommunityBySlug } from '../../core/utils/communitiesApi';
import type { Space, CardType, SpaceBackground } from '../../core/types/space';
import { DEFAULT_QUICK_EMOTIONS } from '../../core/types/space';
import styles from './SpacesScreen.module.css';

// 背景のインラインスタイルを生成
const getBgStyle = (background: SpaceBackground | undefined): React.CSSProperties => {
  if (!background) return { background: 'linear-gradient(135deg, #e9d5ff 0%, #ddd6fe 100%)' };
  switch (background.kind) {
    case 'color':
      return { background: background.value };
    case 'image':
      return { backgroundImage: `url(${background.value})`, backgroundSize: 'cover', backgroundPosition: 'center' };
    case 'pattern':
      // パターンは色でフォールバック
      return { background: 'linear-gradient(135deg, #c4b5fd 0%, #818cf8 100%)' };
    default:
      return { background: 'linear-gradient(135deg, #e9d5ff 0%, #ddd6fe 100%)' };
  }
};

export const SpacesScreen = () => {
  const { state, addSpace, updateSpace, removeSpace, setActiveSpace, communitySlug } = useHossiiStore();
  const { navigate, screenParam } = useRouter();
  const { currentUser, logout, refreshCommunitySlug } = useAuth();
  const { overrideCommunityId, overrideCommunityName, clearOverrideCommunity, setOverrideCommunity } = useAdminNavigation();
  const { spaces } = state;

  const pageTitle = overrideCommunityName
    ? `${overrideCommunityName} のスペース管理`
    : currentUser?.communityName
      ? `${currentUser.communityName} のスペース管理`
      : 'スペース管理';

  const showBackButton = !!(currentUser?.isSuperAdmin && overrideCommunityId);

  // スーパー管理者の override 復元: sessionStorage → URL param → #communities リダイレクト
  useEffect(() => {
    if (!currentUser?.isSuperAdmin) return;
    if (overrideCommunityId) return; // sessionStorage から復元済み

    if (screenParam) {
      // URL に community slug がある場合は API から復元を試みる
      fetchCommunityBySlug(screenParam).then((community) => {
        if (community) {
          setOverrideCommunity(community.id, community.name, community.slug);
        } else {
          navigate('communities');
        }
      });
    } else {
      // URL にも slug がない → communities へリダイレクト
      navigate('communities');
    }
  // overrideCommunityId が null → 設定済みの順に1回だけ走ればよいため
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.isSuperAdmin, screenParam]);

  const handleBack = () => {
    clearOverrideCommunity();
    navigate('communities');
  };

  // アカウントドロップダウン
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  // コミュニティ ID インライン編集
  const [editingCommunityId, setEditingCommunityId] = useState(false);
  const [communityIdValue, setCommunityIdValue] = useState('');
  const [communityIdError, setCommunityIdError] = useState<string | null>(null);
  const [communityIdSaving, setCommunityIdSaving] = useState(false);

  // スペース作成モーダル
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceSlug, setNewSpaceSlug] = useState('');
  const [newSpaceSlugError, setNewSpaceSlugError] = useState<string | null>(null);
  const [newSpaceCardType, setNewSpaceCardType] = useState<CardType>('constellation');

  // インライン編集
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');
  const [editingSlugId, setEditingSlugId] = useState<string | null>(null);
  const [editingSlugValue, setEditingSlugValue] = useState('');
  const [editingSlugError, setEditingSlugError] = useState<string | null>(null);

  // 背景編集中のスペースID
  const [editingBgSpaceId, setEditingBgSpaceId] = useState<string | null>(null);

  // コピー完了表示
  const [copiedSpaceId, setCopiedSpaceId] = useState<string | null>(null);

  // objectURL 追跡（クリーンアップ用）
  const objectURLsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const urls = objectURLsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  // アカウントメニュー外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setShowAccountMenu(false);
      }
    };
    if (showAccountMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAccountMenu]);

  // ---- コミュニティ ID 編集 ----
  const startEditCommunityId = () => {
    setCommunityIdValue(communitySlug ?? '');
    setCommunityIdError(null);
    setEditingCommunityId(true);
  };

  const cancelEditCommunityId = () => {
    setEditingCommunityId(false);
    setCommunityIdError(null);
  };

  const handleCommunityIdChange = (value: string) => {
    const lower = value.toLowerCase();
    setCommunityIdValue(lower);
    const result = validateSpaceURL(lower);
    setCommunityIdError(result.valid ? null : result.error);
  };

  const handleSaveCommunityId = async () => {
    const result = validateSpaceURL(communityIdValue);
    if (!result.valid) return;
    if (communityIdValue === communitySlug) {
      setEditingCommunityId(false);
      return;
    }

    const confirmed = window.confirm(
      'コミュニティ ID を変更すると、配布済みの URL・QR コードがすべて無効になります。変更しますか？'
    );
    if (!confirmed) return;

    setCommunityIdSaving(true);
    const communityId = currentUser?.communityId;
    if (!communityId) {
      setCommunityIdError('コミュニティ情報が取得できませんでした。');
      setCommunityIdSaving(false);
      return;
    }

    const ok = await updateCommunitySlug(communityId, communityIdValue);
    setCommunityIdSaving(false);

    if (ok) {
      refreshCommunitySlug(communityIdValue);
      setEditingCommunityId(false);
    } else {
      setCommunityIdError('保存に失敗しました。このIDはすでに使用されている可能性があります。');
    }
  };

  // ---- モーダル ----
  const openCreateModal = () => {
    setNewSpaceName('');
    setNewSpaceSlug(generateSpaceURL());
    setNewSpaceSlugError(null);
    setNewSpaceCardType('constellation');
    setShowCreateModal(true);
  };

  const handleModalSlugChange = (value: string) => {
    setNewSpaceSlug(value);
    const result = validateSpaceURL(value);
    if (!result.valid) {
      setNewSpaceSlugError(result.error);
    } else if (!isSpaceURLUnique(value, spaces)) {
      setNewSpaceSlugError('このIDはすでに使用されています');
    } else {
      setNewSpaceSlugError(null);
    }
  };

  const handleCreateSpace = () => {
    const trimmedName = newSpaceName.trim();
    if (!trimmedName) return;
    const slugResult = validateSpaceURL(newSpaceSlug);
    if (!slugResult.valid) return;
    if (!isSpaceURLUnique(newSpaceSlug, spaces)) return;

    const newSpace: Space = {
      id: generateId(),
      spaceURL: newSpaceSlug,
      name: trimmedName,
      cardType: newSpaceCardType,
      quickEmotions: DEFAULT_QUICK_EMOTIONS,
      createdAt: new Date(),
    };

    addSpace(newSpace);
    setShowCreateModal(false);
  };

  const isCreateValid =
    newSpaceName.trim().length > 0 &&
    !newSpaceSlugError &&
    validateSpaceURL(newSpaceSlug).valid;

  // ---- スペース名インライン編集 ----
  const startEditName = (space: Space) => {
    setEditingNameId(space.id);
    setEditingNameValue(space.name);
  };

  const commitEditName = (spaceId: string) => {
    const trimmed = editingNameValue.trim();
    if (trimmed) updateSpace(spaceId, { name: trimmed });
    setEditingNameId(null);
  };

  const cancelEditName = () => setEditingNameId(null);

  // ---- スペース slug インライン編集 ----
  const startEditSlug = (space: Space) => {
    setEditingSlugId(space.id);
    setEditingSlugValue(space.spaceURL ?? '');
    setEditingSlugError(null);
  };

  const handleSlugChange = (value: string, spaceId: string) => {
    setEditingSlugValue(value);
    const result = validateSpaceURL(value);
    if (!result.valid) {
      setEditingSlugError(result.error);
    } else if (!isSpaceURLUnique(value, spaces, spaceId)) {
      setEditingSlugError('このIDはすでに使用されています');
    } else {
      setEditingSlugError(null);
    }
  };

  const commitEditSlug = (spaceId: string) => {
    if (editingSlugError) return;
    if (validateSpaceURL(editingSlugValue).valid) {
      updateSpace(spaceId, { spaceURL: editingSlugValue });
    }
    setEditingSlugId(null);
  };

  const cancelEditSlug = () => setEditingSlugId(null);

  // ---- 招待URLコピー ----
  const handleCopyLink = (space: Space) => {
    const slug = space.spaceURL ?? space.id;
    const url = communitySlug
      ? `${window.location.origin}/c/${communitySlug}/s/${slug}`
      : `${window.location.origin}/s/${slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedSpaceId(space.id);
      setTimeout(() => setCopiedSpaceId(null), 2000);
    });
  };

  // ---- 背景更新 ----
  const handleBackgroundSelect = (spaceId: string, background: SpaceBackground) => {
    if (background.kind === 'image' && background.source === 'temp') {
      objectURLsRef.current.add(background.value);
    }
    updateSpace(spaceId, { background });
  };

  const handleImageURLRevoke = (url: string) => {
    URL.revokeObjectURL(url);
    objectURLsRef.current.delete(url);
  };

  // ---- スペース設定へ遷移 ----
  const handleOpenSettings = (space: Space) => {
    setActiveSpace(space.id);
    navigate('settings');
  };

  // ---- 削除 ----
  const handleDeleteSpace = (space: Space) => {
    const confirmed = window.confirm(
      `「${space.name}」を削除しますか？\nこの操作は取り消せません。`
    );
    if (confirmed) removeSpace(space.id);
  };

  // ---- ログアウト ----
  const handleLogout = async () => {
    setShowAccountMenu(false);
    try {
      await logout();
    } catch (e) {
      console.error('[SpacesScreen] logout error:', e);
    }
    window.location.href = '/admin/login';
  };

  return (
    <div className={styles.container}>
      {/* 管理者ヘッダー */}
      <header className={styles.adminHeader}>
        <div className={styles.adminHeaderLeft}>
          {showBackButton && (
            <button
              type="button"
              className={styles.backButton}
              onClick={handleBack}
              title="コミュニティ一覧へ戻る"
            >
              <ChevronLeft size={16} />
              戻る
            </button>
          )}
          <span className={styles.adminLogo}>✨ Hossii</span>
          <span className={styles.adminPageTitle}>{pageTitle}</span>
        </div>

        <div className={styles.adminHeaderRight}>
          {currentUser?.isAdmin && (
            <button
              type="button"
              className={styles.createSpaceButton}
              onClick={openCreateModal}
            >
              + 新しいスペースを作成
            </button>
          )}

          <div className={styles.accountDropdown} ref={accountMenuRef}>
            <button
              type="button"
              className={styles.accountButton}
              onClick={() => setShowAccountMenu((v) => !v)}
            >
              👤 アカウント
            </button>

            {showAccountMenu && (
              <div className={styles.accountMenu}>
                <div className={styles.accountMenuInfo}>
                  <p className={styles.accountMenuName}>
                    {currentUser?.displayName ?? 'コミュニティ管理者'}
                  </p>
                  <p className={styles.accountMenuEmail}>
                    {currentUser?.email ?? ''}
                  </p>

                  {/* コミュニティ ID（スーパー管理者は表示しない） */}
                  {!currentUser?.isSuperAdmin && (
                    <div className={styles.communityIdSection}>
                      <span className={styles.communityIdLabel}>コミュニティ ID</span>

                      {editingCommunityId ? (
                        <div className={styles.communityIdEditArea}>
                          <div className={styles.communityIdInputRow}>
                            <input
                              className={`${styles.communityIdInput} ${communityIdError ? styles.communityIdInputError : ''}`}
                              value={communityIdValue}
                              onChange={(e) => handleCommunityIdChange(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveCommunityId();
                                if (e.key === 'Escape') cancelEditCommunityId();
                              }}
                              placeholder="例: my-community"
                              maxLength={40}
                              disabled={communityIdSaving}
                              autoFocus
                            />
                            <button
                              type="button"
                              className={styles.communityIdActionBtn}
                              onClick={handleSaveCommunityId}
                              disabled={!!communityIdError || !communityIdValue || communityIdSaving}
                              title="保存"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              type="button"
                              className={styles.communityIdActionBtn}
                              onClick={cancelEditCommunityId}
                              disabled={communityIdSaving}
                              title="キャンセル"
                            >
                              <X size={14} />
                            </button>
                          </div>
                          {communityIdError && (
                            <p className={styles.communityIdErrorText}>{communityIdError}</p>
                          )}
                          <p className={styles.communityIdWarning}>
                            ⚠️ 変更すると全スペースの招待 URL・QR コードが無効になります
                          </p>
                        </div>
                      ) : (
                        <div className={styles.communityIdDisplay}>
                          <span className={styles.communityIdValue}>
                            {communitySlug ?? '未設定'}
                          </span>
                          <button
                            type="button"
                            className={styles.communityIdEditBtn}
                            onClick={startEditCommunityId}
                            title="コミュニティ ID を編集"
                          >
                            <Pencil size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className={styles.accountMenuLogout}
                  onClick={handleLogout}
                >
                  ログアウト
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* スペースグリッド */}
      <main className={styles.main}>
        <div className={styles.spaceGrid}>
          {spaces.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyStateIcon}>🌌</div>
              <p className={styles.emptyStateText}>まだスペースがありません</p>
              <p className={styles.emptyStateSubtext}>
                右上の「新しいスペースを作成」から始めましょう
              </p>
            </div>
          )}

          {spaces.map((space) => (
            <div key={space.id} className={styles.spaceCard}>
              {/* 背景サムネイル */}
              <div
                className={styles.cardBg}
                style={getBgStyle(space.background)}
                onClick={() =>
                  setEditingBgSpaceId(editingBgSpaceId === space.id ? null : space.id)
                }
              >
                <div className={styles.cardBgOverlay}>
                  <span className={styles.cardBgEditHint}>背景を変更</span>
                </div>
              </div>

              {/* カード本体 */}
              <div className={styles.cardBody}>
                {/* スペース名 */}
                <div className={styles.cardNameRow}>
                  {editingNameId === space.id ? (
                    <>
                      <input
                        className={styles.cardNameInput}
                        value={editingNameValue}
                        onChange={(e) => setEditingNameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEditName(space.id);
                          if (e.key === 'Escape') cancelEditName();
                        }}
                        autoFocus
                      />
                      <button
                        type="button"
                        className={styles.iconButton}
                        onClick={() => commitEditName(space.id)}
                        title="確定"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        type="button"
                        className={styles.iconButton}
                        onClick={cancelEditName}
                        title="キャンセル"
                      >
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className={styles.cardName} title={space.name}>
                        {space.name}
                      </span>
                      <button
                        type="button"
                        className={styles.iconButton}
                        onClick={() => startEditName(space)}
                        title="名前を変更"
                      >
                        <Pencil size={14} />
                      </button>
                    </>
                  )}
                </div>

                {/* カードタイプ */}
                <div className={styles.cardTypeRow}>
                  <span className={styles.cardTypeLabel}>タイプ</span>
                  <select
                    className={styles.cardTypeSelect}
                    value={space.cardType}
                    onChange={(e) =>
                      updateSpace(space.id, { cardType: e.target.value as CardType })
                    }
                  >
                    <option value="constellation">星座</option>
                    <option value="stamp">スタンプ</option>
                  </select>
                </div>

                {/* スペース ID (slug) */}
                <div>
                  <div className={styles.cardSlugRow}>
                    <span className={styles.cardSlugLabel}>ID</span>
                    {editingSlugId === space.id ? (
                      <>
                        <input
                          className={styles.cardSlugInput}
                          value={editingSlugValue}
                          onChange={(e) => handleSlugChange(e.target.value, space.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitEditSlug(space.id);
                            if (e.key === 'Escape') cancelEditSlug();
                          }}
                          autoFocus
                        />
                        <button
                          type="button"
                          className={styles.iconButton}
                          onClick={() => commitEditSlug(space.id)}
                          title="確定"
                          disabled={!!editingSlugError}
                        >
                          <Check size={12} />
                        </button>
                        <button
                          type="button"
                          className={styles.iconButton}
                          onClick={cancelEditSlug}
                          title="キャンセル"
                        >
                          <X size={12} />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className={styles.cardSlug} title={space.spaceURL ?? space.id}>
                          {space.spaceURL ?? space.id}
                        </span>
                        <button
                          type="button"
                          className={styles.iconButton}
                          onClick={() => startEditSlug(space)}
                          title="IDを編集"
                        >
                          <Pencil size={12} />
                        </button>
                      </>
                    )}
                  </div>
                  {editingSlugId === space.id && editingSlugError && (
                    <p className={styles.cardSlugError}>{editingSlugError}</p>
                  )}
                </div>
              </div>

              {/* アクションボタン */}
              <div className={styles.cardActions}>
                <button
                  type="button"
                  className={`${styles.copyButton} ${
                    copiedSpaceId === space.id ? styles.copyButtonCopied : ''
                  }`}
                  onClick={() => handleCopyLink(space)}
                  title={communitySlug
                    ? `/c/${communitySlug}/s/${space.spaceURL ?? space.id}`
                    : `/s/${space.spaceURL ?? space.id}`}
                >
                  {copiedSpaceId === space.id ? '✓ コピー完了' : '🔗 招待URLをコピー'}
                </button>
                <button
                  type="button"
                  className={styles.settingsButton}
                  onClick={() => handleOpenSettings(space)}
                  title="スペースを設定"
                >
                  <Settings size={14} />
                </button>
                <button
                  type="button"
                  className={styles.deleteButton}
                  onClick={() => handleDeleteSpace(space)}
                  title="削除"
                >
                  🗑
                </button>
              </div>

              {/* 背景セレクター（展開） */}
              {editingBgSpaceId === space.id && (
                <div className={styles.bgSelectorContainer}>
                  <BackgroundSelector
                    currentBackground={space.background}
                    onSelect={(bg) => handleBackgroundSelect(space.id, bg)}
                    onImageURLRevoke={handleImageURLRevoke}
                    spaceId={space.id}
                    savedBackgroundImages={space.savedBackgroundImages}
                    onUpdateSavedImages={(urls) => updateSpace(space.id, { savedBackgroundImages: urls })}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </main>

      {/* スペース作成モーダル */}
      {showCreateModal && (
        <div
          className={styles.modalOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreateModal(false);
          }}
        >
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>新しいスペースを作成</h2>
              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={() => setShowCreateModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>スペース名</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="例: 朝のチームスペース"
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>スペース ID（招待URLの末尾）</label>
                <div className={styles.formSlugRow}>
                  <span className={styles.formSlugPrefix}>/s/</span>
                  <input
                    type="text"
                    className={styles.formInput}
                    placeholder="abc123xy"
                    value={newSpaceSlug}
                    onChange={(e) => handleModalSlugChange(e.target.value)}
                  />
                </div>
                {newSpaceSlugError && (
                  <p className={styles.formError}>{newSpaceSlugError}</p>
                )}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>カードタイプ</label>
                <div className={styles.formRadioGroup}>
                  <label className={styles.formRadioLabel}>
                    <input
                      type="radio"
                      name="newCardType"
                      checked={newSpaceCardType === 'constellation'}
                      onChange={() => setNewSpaceCardType('constellation')}
                    />
                    星座
                  </label>
                  <label className={styles.formRadioLabel}>
                    <input
                      type="radio"
                      name="newCardType"
                      checked={newSpaceCardType === 'stamp'}
                      onChange={() => setNewSpaceCardType('stamp')}
                    />
                    スタンプ
                  </label>
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.modalCancelButton}
                onClick={() => setShowCreateModal(false)}
              >
                キャンセル
              </button>
              <button
                type="button"
                className={styles.modalSubmitButton}
                onClick={handleCreateSpace}
                disabled={!isCreateValid}
              >
                作成する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
