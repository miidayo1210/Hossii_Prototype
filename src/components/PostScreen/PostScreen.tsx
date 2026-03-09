import { useState, useEffect, useMemo, useRef } from 'react';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { useRouter } from '../../core/hooks/useRouter';
import { useAuth } from '../../core/contexts/AuthContext';
import { loadSpaceSettings } from '../../core/utils/settingsStorage';
import { addStamp } from '../../core/utils/stampStorage';
import { upsertStampCount } from '../../core/utils/stampsApi';
import { uploadHossiiImage } from '../../core/utils/imageStorageApi';
import { saveImageLocally } from '../../core/utils/saveImageLocally';
import { generateId } from '../../core/utils';
import type { SpaceSettings } from '../../core/types/settings';
import { TopRightMenu } from '../Navigation/TopRightMenu';
import { HossiiMini } from '../Hossii/HossiiMini';
import { DrawingModal } from '../DrawingModal/DrawingModal';
import { EMOJI_BY_EMOTION } from '../../core/assets/emotions';
import { DEFAULT_QUICK_EMOTIONS } from '../../core/types/space';
import type { EmotionKey, ToastState } from '../../core/types';
import styles from './PostScreen.module.css';

// F01: 吹き出し色プリセット
const BUBBLE_COLOR_PRESETS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEAA7',
  '#DDA0DD',
  '#98D8C8',
  '#F7DC6F',
];

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

// F09: テキストから #タグ を抽出
// 全角 ＃ を半角 # に正規化してからマッチする
function parseHashtags(text: string): string[] {
  const normalized = text.replace(/＃/g, '#');
  const matches = normalized.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  return [...new Set(matches.map((t) => t.slice(1)))];
}

export const PostScreen = () => {
  const [selectedEmotion, setSelectedEmotion] = useState<EmotionKey | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [greeting, setGreeting] = useState('');

  // F01: 吹き出し色
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  // F09: ハッシュタグ
  const [hashtagInput, setHashtagInput] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [selectedPresetTags, setSelectedPresetTags] = useState<string[]>([]);

  // F10: 画像投稿
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // F08: お絵描きモーダル
  const [showDrawingModal, setShowDrawingModal] = useState(false);

  // numberPost: 数値投稿
  const [numberInput, setNumberInput] = useState('');

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

  // activeSpace からプリセットタグを取得（state から直接読み取り）
  const presetTags = state.spaces.find((s) => s.id === state.activeSpaceId)?.presetTags ?? [];

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
    setSelectedEmotion(selectedEmotion === key ? null : key);
  };

  // F08: お絵描き完了
  const handleDrawingComplete = (file: File) => {
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    setShowDrawingModal(false);
  };

  // F10: 画像選択（カメラ撮影 / ギャラリー共通）
  // lastModified が1分以内 → カメラで撮りたてとみなしてローカル保存も実行
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setToast({ message: '画像ファイルを選択してね', type: 'error' });
      e.target.value = '';
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    const isJustTaken = Date.now() - file.lastModified < 60_000;
    if (isJustTaken) {
      await saveImageLocally(file, `hossii-photo-${Date.now()}.jpg`);
    }
  };

  const handleImageRemove = () => {
    setImagePreview(null);
    setImageFile(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  // F09: ハッシュタグ追加
  const handleHashtagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // IME 変換中（日本語入力の途中）は無視する
    if (e.isComposing) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === '　') {
      e.preventDefault();
      addHashtagFromInput();
    }
  };

  const addHashtagFromInput = () => {
    // 全角 ＃ も半角 # と同様に先頭から除去する
    const raw = hashtagInput.trim().replace(/^[#＃]+/, '');
    if (!raw) return;
    if (!hashtags.includes(raw)) {
      setHashtags((prev) => [...prev, raw]);
    }
    setHashtagInput('');
  };

  const removeHashtag = (tag: string) => {
    setHashtags((prev) => prev.filter((t) => t !== tag));
  };

  // プリセットタグのトグル（# 付き文字列を # なしで管理）
  const togglePresetTag = (tagWithHash: string) => {
    const raw = tagWithHash.replace(/^#/, '');
    setSelectedPresetTags((prev) =>
      prev.includes(raw) ? prev.filter((t) => t !== raw) : [...prev, raw]
    );
  };

  const handleSubmit = async () => {
    if (sending) return;

    const hasImage = !!imageFile;
    const parsedNumber = numberInput.trim() !== '' ? parseFloat(numberInput) : null;
    const hasNumber = parsedNumber != null && !isNaN(parsedNumber);
    if (!selectedEmotion && !message.trim() && !hasImage && !hasNumber) {
      setToast({ message: '気持ち・メッセージ・写真・数値のいずれかを入力してね！', type: 'error' });
      return;
    }

    setSending(true);

    try {
      // F09: メッセージ本文からもハッシュタグを抽出してマージ（自由入力のみ）
      const parsedFromMessage = parseHashtags(message);
      const allHashtags = [...new Set([...hashtags, ...parsedFromMessage])];

      // F10: 画像アップロード
      let imageUrl: string | undefined;
      if (imageFile) {
        const activeSpace = getActiveSpace();
        const spaceId = activeSpace?.id ?? 'default';
        const hossiiId = generateId();
        const uploaded = await uploadHossiiImage(spaceId, hossiiId, imageFile);
        if (uploaded) {
          imageUrl = uploaded;
        } else {
          // アップロード失敗: 画像のみ投稿なら中断、テキストがある場合は続行
          if (!selectedEmotion && !message.trim()) {
            setToast({ message: '画像のアップロードに失敗しました。もう一度試してね', type: 'error' });
            return;
          }
          setToast({ message: '画像のアップロードに失敗しました。テキストのみ投稿します', type: 'error' });
        }
      }

      addHossii({
        message: message.trim(),
        emotion: selectedEmotion ?? undefined,
        bubbleColor: selectedColor ?? undefined,
        hashtags: allHashtags.length > 0 ? allHashtags : undefined,
        tags: selectedPresetTags.length > 0 ? selectedPresetTags : undefined,
        imageUrl,
        numberValue: hasNumber ? parsedNumber! : undefined,
      });

      // スタンプを獲得
      if (currentUser) {
        const newStampCount = addStamp(currentUser.uid);
        // ログイン済みユーザーのみ Supabase にも保存（非同期・fire-and-forget）
        upsertStampCount(currentUser.uid, newStampCount);
        const isNewCard = newStampCount % 20 === 0;

        if (isNewCard) {
          setToast({ message: '🎉 スタンプカードが完成したよ！', type: 'success' });
        } else {
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
      setSelectedColor(null);
      setHashtags([]);
      setHashtagInput('');
      setSelectedPresetTags([]);
      setNumberInput('');
      handleImageRemove();
      shuffleGreeting();

      setTimeout(() => {
        navigate('screen');
      }, 800);
    } finally {
      setSending(false);
    }
  };

  const canSubmit = selectedEmotion || message.trim() || imagePreview || numberInput.trim() !== '';

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

        {/* メッセージ入力 - commentPost が有効の場合のみ */}
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

        {/* クイック感情バー - emotionPost が有効の場合のみ */}
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

        {/* F01: 吹き出し色選択 */}
        <div className={styles.section}>
          <div className={styles.label}>吹き出しの色（任意）</div>
          <div className={styles.colorPalette}>
            <button
              type="button"
              className={`${styles.colorSwatch} ${selectedColor === null ? styles.colorSwatchSelected : ''}`}
              style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)' }}
              onClick={() => setSelectedColor(null)}
              title="デフォルト"
              aria-label="デフォルト色"
            />
            {BUBBLE_COLOR_PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                className={`${styles.colorSwatch} ${selectedColor === color ? styles.colorSwatchSelected : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => setSelectedColor(selectedColor === color ? null : color)}
                title={color}
                aria-label={`色 ${color}`}
              />
            ))}
          </div>
        </div>

        {/* F09: ハッシュタグ */}
        <div className={styles.section}>
          <div className={styles.label}>ハッシュタグ（任意）</div>

          {/* プリセットタグ（スペースに登録されている場合のみ表示） */}
          {presetTags.length > 0 && (
            <div className={styles.presetTagsRow}>
              {presetTags.map((tag) => {
                const raw = tag.replace(/^#/, '');
                const isSelected = selectedPresetTags.includes(raw);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => togglePresetTag(tag)}
                    className={`${styles.presetTagChip} ${isSelected ? styles.presetTagChipSelected : ''}`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          )}

          <div className={styles.hashtagInputRow}>
            <span className={styles.hashtagPrefix}>#</span>
            <input
              type="text"
              value={hashtagInput}
              onChange={(e) => setHashtagInput(e.target.value)}
              onKeyDown={handleHashtagKeyDown}
              onBlur={addHashtagFromInput}
              placeholder="タグを入力してEnter"
              className={styles.hashtagInput}
              maxLength={30}
            />
          </div>
          {hashtags.length > 0 && (
            <div className={styles.hashtagChips}>
              {hashtags.map((tag) => (
                <span key={tag} className={styles.hashtagChip}>
                  #{tag}
                  <button
                    type="button"
                    onClick={() => removeHashtag(tag)}
                    className={styles.hashtagRemove}
                    aria-label={`${tag} を削除`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* numberPost: 数値入力 - numberPost が有効の場合のみ */}
        {spaceSettings?.features.numberPost && (
          <div className={styles.section}>
            <div className={styles.label}>数値（任意）</div>
            <input
              type="number"
              value={numberInput}
              onChange={(e) => setNumberInput(e.target.value)}
              placeholder="例: 36.5"
              className={styles.numberInput}
              step="any"
            />
          </div>
        )}

        {/* F10: 写真添付 / F08: お絵描き - photoPost が有効の場合のみ */}
        {spaceSettings?.features.photoPost !== false && (
          <div className={styles.section}>
            <div className={styles.label}>写真 / お絵描き（任意）</div>
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
              <div className={styles.mediaButtons}>
                <label className={styles.imageUploadArea}>
                  <span className={styles.imageUploadIcon}>📸</span>
                  <span className={styles.imageUploadText}>写真を添付</span>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className={styles.imageInput}
                  />
                </label>
                <button
                  type="button"
                  className={styles.drawingButton}
                  onClick={() => setShowDrawingModal(true)}
                >
                  <span className={styles.imageUploadIcon}>✏️</span>
                  <span className={styles.imageUploadText}>お絵描き</span>
                </button>
              </div>
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

      {/* F08: お絵描きモーダル */}
      {showDrawingModal && (
        <DrawingModal
          onComplete={handleDrawingComplete}
          onClose={() => setShowDrawingModal(false)}
        />
      )}
    </div>
  );
};
