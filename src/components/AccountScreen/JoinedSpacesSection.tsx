import { useState, useEffect, useCallback, useRef } from 'react';
import { ExternalLink } from 'lucide-react';
import { useAuth } from '../../core/contexts/useAuth';
import { fetchMyJoinedSpaces, type JoinedSpace } from '../../core/utils/joinedSpacesApi';
import styles from './JoinedSpacesSection.module.css';

type Status = 'idle' | 'loading' | 'error' | 'ready';

/**
 * Phase 2E: アカウントページに、ログイン本人が参加しているスペース一覧を表示する。
 * - 未ログイン（ゲスト）は取得せず、ログイン案内を表示する。
 * - loading / empty / error / success の各状態を持つ。
 * - スペースを開く導線は既存の /s/{slug} を使う（slug 欠損時は導線を出さない）。
 * - 管理者権限判定には使わない（role/status は取得・表示しない）。
 */
export const JoinedSpacesSection = () => {
  const { currentUser } = useAuth();
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
        <li key={s.membershipId} className={styles.item}>
          <div className={styles.itemMain}>
            <span className={styles.spaceName}>{s.spaceName ?? '不明なスペース'}</span>
            {s.communityName && (
              <span className={styles.communityName}>{s.communityName}</span>
            )}
            <span className={styles.nickname}>
              {s.spaceNickname
                ? `ニックネーム: ${s.spaceNickname}`
                : 'ニックネーム未設定'}
            </span>
          </div>
          {s.spaceUrl ? (
            <a className={styles.openLink} href={`/s/${s.spaceUrl}`}>
              <ExternalLink size={14} />
              開く
            </a>
          ) : (
            <span className={styles.openDisabled} title="このスペースは現在開けません">
              開けません
            </span>
          )}
        </li>
      ))}
    </ul>
  );
};
