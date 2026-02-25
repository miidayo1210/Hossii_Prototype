import { useState, useEffect, useMemo } from 'react';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { useRouter } from '../../core/hooks/useRouter';
import { useAuth } from '../../core/contexts/AuthContext';
import { loadSpaceSettings } from '../../core/utils/settingsStorage';
import { addStamp } from '../../core/utils/stampStorage';
import type { SpaceSettings } from '../../core/types/settings';
import { TopRightMenu } from '../Navigation/TopRightMenu';
import { HossiiMini } from '../Hossii/HossiiMini';
import { EMOJI_BY_EMOTION } from '../../core/assets/emotions';
import { DEFAULT_QUICK_EMOTIONS } from '../../core/types/space';
import type { EmotionKey, ToastState } from '../../core/types';
import styles from './PostScreen.module.css';

// TODO: 将来的に実装
// - OnboardingHossii: 初回オンボーディング
// - HossiiSendButton: カスタム送信ボタン
// - 画像アップロード機能
// - Hossii表情アセット切り替え

// 感情のラベルマッピング（全種類）
const EMOTION_LABELS: Record<EmotionKey, string> = {
  wow: 'Wow',
  empathy: '刺さった',
  inspire: '閃いた',
  think: '気になる',
  laugh: '笑った',
  joy: 'うれしい',
  moved: 'ぐっときた',
  fun: '楽しい',
};

// Hossii のセリフプール（簡略版）
const GREETING_POOL = [
  '今日もいっしょに輝こう ⭐️',
  '来てくれてうれしすぎる〜〜！！',
  'ワクワクをひとつ、置いてってね！',
  'なんか、いいこと起きそうな予感…！',
  '気持ちボタンを押すだけでもいいんだよ〜✨',
  'ぽちっとするだけで場が広がるよ〜🌸',
  '君の一声が、誰かを救うんだよ〜！📣',
];

export const PostScreen = () => {
  const [selectedEmotion, setSelectedEmotion] = useState<EmotionKey | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [greeting, setGreeting] = useState('');

  // TODO: 画像プレビュー（UIのみ、アップロード機能は未実装）
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const { state, addHossii, getActiveSpace } = useHossiiStore();
  const { showHossii } = state;
  const { navigate } = useRouter();
  const { currentUser } = useAuth();

  // スペース設定の読み込み
  const [spaceSettings, setSpaceSettings] = useState<SpaceSettings | null>(null);

  useEffect(() => {
    const activeSpace = getActiveSpace();
    if (activeSpace) {
      const settings = loadSpaceSettings(activeSpace.id, activeSpace.name);
      setSpaceSettings(settings);
    }
  }, [getActiveSpace]);

  // フォーカス時に設定を再読み込み
  useEffect(() => {
    const handleFocus = () => {
      const activeSpace = getActiveSpace();
      if (activeSpace) {
        const settings = loadSpaceSettings(activeSpace.id, activeSpace.name);
        setSpaceSettings(settings);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [getActiveSpace]);

  // activeSpace から quickEmotions を取得（毎回取得、固定配列NG）
  const quickEmotions = useMemo(() => {
    const activeSpace = getActiveSpace();
    return activeSpace?.quickEmotions ?? DEFAULT_QUICK_EMOTIONS;
  }, [getActiveSpace]);

  // quickEmotions からボタンデータを生成
  const emotionButtons = useMemo(() => {
    return quickEmotions.map((key) => ({
      key,
      emoji: EMOJI_BY_EMOTION[key],
      label: EMOTION_LABELS[key],
    }));
  }, [quickEmotions]);

  // 初回マウント時にランダムセリフを設定
  useEffect(() => {
    shuffleGreeting();
  }, []);

  // Toast自動消去
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const shuffleGreeting = () => {
    const index = Math.floor(Math.random() * GREETING_POOL.length);
    setGreeting(GREETING_POOL[index]);
  };

  const handleEmotionClick = (key: EmotionKey) => {
    // トグル動作：同じものを押したら解除
    setSelectedEmotion(selectedEmotion === key ? null : key);
  };

  // TODO: 画像選択（UIのみ）
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setToast({ message: '画像ファイルを選択してね', type: 'error' });
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleImageRemove = () => {
    setImagePreview(null);
  };

  const handleSubmit = () => {
    if (sending) return;

    // 送信可否チェック：emotion または message があればOK
    if (!selectedEmotion && !message.trim()) {
      setToast({ message: '気持ちかメッセージを入力してね！', type: 'error' });
      return;
    }

    setSending(true);

    // ストアに追加（message と emotion を分離して渡す）
    addHossii({
      message: message.trim(),
      emotion: selectedEmotion ?? undefined,
    });

    // スタンプを獲得
    if (currentUser) {
      const newStampCount = addStamp(currentUser.uid);
      const isNewCard = newStampCount % 20 === 0;

      if (isNewCard) {
        setToast({ message: '🎉 スタンプカードが完成したよ！', type: 'success' });
      } else {
        // 成功フィードバック
        let toastMsg = '置いたよ〜！⭐ スタンプ+1';
        if (selectedEmotion) {
          const emoji = EMOJI_BY_EMOTION[selectedEmotion];
          const label = EMOTION_LABELS[selectedEmotion];
          toastMsg = `${emoji} ${label} を置いたよ！⭐ スタンプ+1`;
        }
        setToast({ message: toastMsg, type: 'success' });
      }
    }

    // クリア
    setSelectedEmotion(null);
    setMessage('');
    setImagePreview(null);
    shuffleGreeting();

    setSending(false);

    // 少し待ってからスペースへ遷移
    setTimeout(() => {
      navigate('screen');
    }, 800);
  };

  // emotion または message があれば送信可能
  const canSubmit = selectedEmotion || message.trim();

  return (
    <div className={styles.container}>
      {/* 右上メニュー */}
      <TopRightMenu />

      {/* ヘッダー：Hossii（showHossii時のみ） */}
      {showHossii && (
        <header className={styles.header}>
          <HossiiMini onClick={shuffleGreeting} hossiiColor={spaceSettings?.hossiiColor} />
          <div className={styles.greetingArea}>
            <div className={styles.greeting}>{greeting}</div>
          </div>
        </header>
      )}

      {/* メインコンテンツ */}
      <main className={styles.main}>
        <h2 className={styles.title}>気持ちを置く 🌸</h2>

        {/* 全ての機能が無効の場合の警告 */}
        {spaceSettings &&
         !spaceSettings.features.commentPost &&
         !spaceSettings.features.emotionPost &&
         !spaceSettings.features.photoPost && (
          <div className={styles.disabledNotice}>
            このスペースでは投稿機能が無効になっています。
            スペース管理画面で設定を変更してください。
          </div>
        )}

        {/* メッセージ入力（本線） - commentPost が有効の場合のみ */}
        {spaceSettings?.features.commentPost !== false && (
          <div className={styles.section}>
            <div className={styles.label}>メッセージ</div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="なんでも書いてね…（任意）"
              className={styles.textarea}
              maxLength={200}
            />
          </div>
        )}

        {/* クイック感情バー（近道） - emotionPost が有効の場合のみ */}
        {spaceSettings?.features.emotionPost !== false && (
          <div className={styles.section}>
            <div className={styles.label}>気持ちをつける（任意）</div>
            <div className={styles.emotionBar}>
              {emotionButtons.map((btn) => (
                <button
                  key={btn.key}
                  type="button"
                  onClick={() => handleEmotionClick(btn.key)}
                  className={`${styles.emotionChip} ${
                    selectedEmotion === btn.key ? styles.emotionChipSelected : ''
                  }`}
                  title={btn.label}
                >
                  <span className={styles.emotionChipEmoji}>{btn.emoji}</span>
                </button>
              ))}
            </div>
            {selectedEmotion && (
              <div className={styles.selectedEmotionHint}>
                {EMOJI_BY_EMOTION[selectedEmotion]} {EMOTION_LABELS[selectedEmotion]}
              </div>
            )}
          </div>
        )}

        {/* 写真添付（UIのみ） - photoPost が有効の場合のみ */}
        {spaceSettings?.features.photoPost !== false && (
          <div className={styles.section}>
            <div className={styles.label}>写真（任意）</div>
            {imagePreview ? (
              <div className={styles.imagePreviewContainer}>
                <img
                  src={imagePreview}
                  alt="Preview"
                  className={styles.imagePreview}
                />
                <button
                  type="button"
                  onClick={handleImageRemove}
                  className={styles.imageRemoveButton}
                >
                  ×
                </button>
              </div>
            ) : (
              <label className={styles.imageUploadArea}>
                <span className={styles.imageUploadIcon}>📸</span>
                <span className={styles.imageUploadText}>写真を添付</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className={styles.imageInput}
                />
              </label>
            )}
          </div>
        )}

        {/* 送信ボタン */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={sending || !canSubmit}
          className={styles.submitButton}
        >
          {sending ? '送信中...' : '気持ちを置く'}
        </button>
      </main>

      {/* Toast */}
      {toast && (
        <div className={`${styles.toast} ${toast.type === 'success' ? styles.toastSuccess : styles.toastError}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
};
