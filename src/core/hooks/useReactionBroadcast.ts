import { useEffect, useRef, useCallback } from 'react';
import type { EmotionKey, LogType, SpeechLevel } from '../types';

/**
 * リアクションイベントの型
 */
export type ReactionEvent = {
  type: 'REACTION';
  spaceId: string;
  hossiiId: string;
  emotion?: EmotionKey;
  authorName?: string;
  createdAt: number; // timestamp
  logType?: LogType;
  speechLevel?: SpeechLevel;
  nonce: string; // 重複排除用
};

type UseReactionBroadcastOptions = {
  activeSpaceId: string;
  onReaction: (event: ReactionEvent) => void;
};

const CHANNEL_NAME = 'hossii-reactions';
const NONCE_EXPIRY = 10000; // 10秒でnonceを削除

// nonce生成
function generateNonce(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * BroadcastChannel を使った全タブリアクション同期
 * - fallback として localStorage の storage イベントも使用
 */
export function useReactionBroadcast({
  activeSpaceId,
  onReaction,
}: UseReactionBroadcastOptions) {
  const channelRef = useRef<BroadcastChannel | null>(null);
  const seenNoncesRef = useRef<Set<string>>(new Set());
  const onReactionRef = useRef(onReaction);
  onReactionRef.current = onReaction;

  // nonce をクリーンアップ（定期的に古いものを削除）
  useEffect(() => {
    const interval = setInterval(() => {
      // 10秒以上経過したnonceは削除（簡易的にセット全体をクリア）
      if (seenNoncesRef.current.size > 100) {
        seenNoncesRef.current.clear();
      }
    }, NONCE_EXPIRY);

    return () => clearInterval(interval);
  }, []);

  // イベント処理（重複チェック + アクティブフォレストチェック）
  const handleEvent = useCallback(
    (event: ReactionEvent) => {
      // 重複チェック
      if (seenNoncesRef.current.has(event.nonce)) {
        return;
      }
      seenNoncesRef.current.add(event.nonce);

      // アクティブスペースのみ反応
      if (event.spaceId !== activeSpaceId) {
        return;
      }

      onReactionRef.current(event);
    },
    [activeSpaceId]
  );

  // BroadcastChannel の初期化
  useEffect(() => {
    // BroadcastChannel が使えるか確認
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const channel = new BroadcastChannel(CHANNEL_NAME);
        channelRef.current = channel;

        channel.onmessage = (event: MessageEvent<ReactionEvent>) => {
          if (event.data?.type === 'REACTION') {
            handleEvent(event.data);
          }
        };

        return () => {
          channel.close();
          channelRef.current = null;
        };
      } catch {
        // BroadcastChannel がサポートされていない場合は無視
      }
    }
  }, [handleEvent]);

  // localStorage fallback（BroadcastChannel 非対応ブラウザ用）
  useEffect(() => {
    const storageKey = 'hossii.lastReaction';

    const handleStorage = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        try {
          const event = JSON.parse(e.newValue) as ReactionEvent;
          if (event?.type === 'REACTION') {
            handleEvent(event);
          }
        } catch {
          // ignore parse errors
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [handleEvent]);

  // リアクションをブロードキャスト
  const broadcastReaction = useCallback(
    (params: {
      hossiiId: string;
      emotion?: EmotionKey;
      authorName?: string;
      logType?: LogType;
      speechLevel?: SpeechLevel;
    }) => {
      const event: ReactionEvent = {
        type: 'REACTION',
        spaceId: activeSpaceId,
        hossiiId: params.hossiiId,
        emotion: params.emotion,
        authorName: params.authorName,
        createdAt: Date.now(),
        logType: params.logType,
        speechLevel: params.speechLevel,
        nonce: generateNonce(),
      };

      // 自分自身のnonceを記録（自分の発火では反応しないように）
      seenNoncesRef.current.add(event.nonce);

      // BroadcastChannel で送信
      if (channelRef.current) {
        try {
          channelRef.current.postMessage(event);
        } catch {
          // ignore
        }
      }

      // localStorage fallback（他タブに通知）
      try {
        localStorage.setItem('hossii.lastReaction', JSON.stringify(event));
      } catch {
        // ignore
      }
    },
    [activeSpaceId]
  );

  return { broadcastReaction };
}
