import { useState, useEffect, useCallback, useRef } from 'react';
import { ExternalLink, Pencil } from 'lucide-react';
import { useAuth } from '../../core/contexts/useAuth';
import { useHossiiActions } from '../../core/hooks/useHossiiActions';
import { fetchMyJoinedSpaces, type JoinedSpace } from '../../core/utils/joinedSpacesApi';
import { updateMySpaceNickname } from '../../core/utils/spaceMembershipsApi';
import {
  normalizeSpaceNickname,
  MAX_SPACE_NICKNAME_LENGTH,
} from '../../core/utils/spaceNicknameRules';
import { SpaceArchiveBadge } from '../Spaces/SpaceArchiveBadge';
import styles from './JoinedSpacesSection.module.css';

type Status = 'idle' | 'loading' | 'error' | 'ready';

/**
 * Phase 2E/2F: アカウントページに、ログイン本人が参加しているスペース一覧を表示し、
 * 各スペースの自分のニックネームを変更できるようにする。
 * - 未ログイン（ゲスト）は取得せず、ログイン案内を表示する。
 * - loading / empty / error / success の各状態を持つ。
 * - スペースを開く導線は既存の /s/{slug} を使う（slug 欠損時は導線を出さない）。
 * - ニックネーム変更は SECURITY DEFINER RPC 経由（本人・space_nickname のみ）。
 * - 管理者権限判定には使わない（role/status は取得・表示しない）。
 */
export const JoinedSpacesSection = () => {
  const { currentUser } = useAuth();
  const { refreshPostAuthorDisplayNames } = useHossiiActions();
  const uid = currentUser?.uid ?? null;
  const [status, setStatus] = useState<Status>('idle');
  const [items, setItems] = useState<JoinedSpace[]>([]);
  // 古い非同期応答で新しい状態を上書きしないための世代カウンタ。
  const reqIdRef = useRef(0);

  const load = useCallback(async () => {
    const reqId = ++reqIdRef.current;
    setStatus('loading');
    try {
      const rows = await fetchMyJoinedSpaces();
      if (reqId !== reqIdRef.current) return;
      setItems(rows);
      setStatus('ready');
    } catch {
      if (reqId !== reqIdRef.current) return;
      // PII を出さず、失敗の事実のみ記録する。
      console.error('[JoinedSpacesSection] failed to load joined spaces');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    // 未ログインでは取得しない（render 側で currentUser を見てログイン案内を出す）。
    // 進行中の取得は世代カウンタで無効化し、古い応答での上書きを防ぐ。
    if (!uid) {
      reqIdRef.current += 1;
      return;
    }
    // setState を effect 内で同期実行しない（idle も「読み込み中」を表示するため体感差なし）。
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [uid, load]);

  // ニックネーム変更成功時、対象 membership の表示名だけをローカル更新し、
  // 同スペースが現在アクティブなら投稿者現在名マップを最小再取得する。
  const handleSaved = useCallback(
    (membershipId: string, spaceId: string, nickname: string | null) => {
      setItems((prev) =>
        prev.map((it) =>
          it.membershipId === membershipId ? { ...it, spaceNickname: nickname } : it,
        ),
      );
      refreshPostAuthorDisplayNames(spaceId);
    },
    [refreshPostAuthorDisplayNames],
  );

  if (!currentUser) {
    return (
      <p className={styles.note}>
        ログインすると、参加しているスペースがここに表示されます。
      </p>
    );
  }

  if (status === 'idle' || status === 'loading') {
    return <p className={styles.note}>読み込み中…</p>;
  }

  if (status === 'error') {
    return (
      <div className={styles.note}>
        <p>参加スペースの取得に失敗しました。時間をおいて再度お試しください。</p>
        <button type="button" className={styles.retryBtn} onClick={() => void load()}>
          再読み込み
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return <p className={styles.note}>まだ参加しているスペースはありません。</p>;
  }

  return (
    <ul className={styles.list}>
      {items.map((s) => (
        <JoinedSpaceItem key={s.membershipId} space={s} onSaved={handleSaved} />
      ))}
    </ul>
  );
};

type JoinedSpaceItemProps = {
  space: JoinedSpace;
  onSaved: (membershipId: string, spaceId: string, nickname: string | null) => void;
};

const JoinedSpaceItem = ({ space, onSaved }: JoinedSpaceItemProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(space.spaceNickname ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = () => {
    setDraft(space.spaceNickname ?? '');
    setError(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    if (saving) return;
    setEditing(false);
    setError(null);
  };

  const save = async () => {
    if (saving) return;
    const normalized = normalizeSpaceNickname(draft);
    if (!normalized.ok) {
      setError(
        normalized.reason === 'too_long'
          ? `ニックネームは${MAX_SPACE_NICKNAME_LENGTH}文字以内にしてください。`
          : '使用できない文字が含まれています。',
      );
      return;
    }
    setSaving(true);
    setError(null);
    const res = await updateMySpaceNickname(space.spaceId, draft);
    if (!res.ok) {
      // 失敗時は元の名前を維持したまま、編集中の入力を残してエラー表示する。
      setSaving(false);
      setError('ニックネームの変更に失敗しました。時間をおいてお試しください。');
      return;
    }
    setSaving(false);
    setEditing(false);
    onSaved(space.membershipId, space.spaceId, res.nickname);
  };

  return (
    <li className={styles.item}>
      <div className={styles.itemMain}>
        <span className={styles.spaceNameRow}>
          <span className={styles.spaceName}>{space.spaceName ?? '不明なスペース'}</span>
          {space.isArchived && <SpaceArchiveBadge />}
        </span>
        {space.communityName && (
          <span className={styles.communityName}>{space.communityName}</span>
        )}
        {editing ? (
          <div className={styles.editRow}>
            <input
              className={styles.nicknameInput}
              type="text"
              value={draft}
              maxLength={MAX_SPACE_NICKNAME_LENGTH}
              placeholder="ニックネーム（未設定でデフォルト名）"
              disabled={saving}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void save();
                if (e.key === 'Escape') cancelEdit();
              }}
            />
            <div className={styles.editButtons}>
              <button
                type="button"
                className={styles.saveBtn}
                disabled={saving}
                onClick={() => void save()}
              >
                {saving ? '保存中…' : '保存'}
              </button>
              <button
                type="button"
                className={styles.cancelBtn}
                disabled={saving}
                onClick={cancelEdit}
              >
                キャンセル
              </button>
            </div>
            {error && <span className={styles.editError}>{error}</span>}
          </div>
        ) : (
          <span className={styles.nickname}>
            {space.spaceNickname
              ? `ニックネーム: ${space.spaceNickname}`
              : 'ニックネーム未設定'}
            <button
              type="button"
              className={styles.editLink}
              onClick={startEdit}
              aria-label="ニックネームを変更"
            >
              <Pencil size={12} />
              変更
            </button>
          </span>
        )}
      </div>
      {space.spaceUrl ? (
        <a className={styles.openLink} href={`/s/${space.spaceUrl}`}>
          <ExternalLink size={14} />
          開く
        </a>
      ) : (
        <span className={styles.openDisabled} title="このスペースは現在開けません">
          開けません
        </span>
      )}
    </li>
  );
};
