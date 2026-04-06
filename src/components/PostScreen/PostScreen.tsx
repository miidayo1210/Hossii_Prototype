import { useState, useEffect, useMemo, useRef, useId } from 'react';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { useDisplayPrefs } from '../../core/contexts/DisplayPrefsContext';
import { useRouter } from '../../core/hooks/useRouter';
import { useAuth } from '../../core/contexts/useAuth';
import { useFeatureFlags } from '../../core/hooks/useFeatureFlags';
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
import {
  loadContinuousPost,
  loadPostBubbleColorDraft,
  saveContinuousPost,
  savePostBubbleColorDraft,
} from '../../core/utils/displayPrefsStorage';
import {
  BUBBLE_COLOR_PALETTES,
  getBubblePalette,
  type BubblePaletteId,
} from '../../core/utils/bubbleColorPalettes';
import styles from './PostScreen.module.css';

// B02: 吹き出し形状プリセット（14種）
type BubbleShapePreset = { path: string; label: string };
const BUBBLE_SHAPE_PRESETS: BubbleShapePreset[] = [
  { path: '/assets/bubble-shapes/Hossiiコメ枠ハート.png', label: 'ハート' },
  { path: '/assets/bubble-shapes/Hossiiコメ枠雲.png', label: '雲' },
  { path: '/assets/bubble-shapes/Hossiiコメ枠風船.png', label: '風船' },
  { path: '/assets/bubble-shapes/Hossiiコメ枠葉っぱ.png', label: '葉っぱ' },
  { path: '/assets/bubble-shapes/Hossiiコメ枠雫.png', label: '雫' },
  { path: '/assets/bubble-shapes/Hossiiコメ枠付箋小.png', label: '付箋' },
  { path: '/assets/bubble-shapes/Hossiiコメ枠メモ大.png', label: 'メモ' },
  { path: '/assets/bubble-shapes/Hossiiコメ枠ネコ.png', label: 'ネコ' },
  { path: '/assets/bubble-shapes/Hossiiコメ枠金魚.png', label: '金魚' },
  { path: '/assets/bubble-shapes/Hossiiコメ枠いるか.png', label: 'いるか' },
  { path: '/assets/bubble-shapes/Hossiiコメ枠イチョウ.png', label: 'イチョウ' },
  { path: '/assets/bubble-shapes/Hossiiコメ枠コウモリ.png', label: 'コウモリ' },
  { path: '/assets/bubble-shapes/Hossiiコメ枠絵馬.png', label: '絵馬' },
  { path: '/assets/bubble-shapes/Hossiiコメ枠紙ひこうき.png', label: '紙ひこうき' },
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

// 位置選択グリッドのエリアラベル（左上から右下へ）
const AREA_LABELS = ['上・左', '上・中', '上・右', '中・左', '中・中', '中・右', '下・左', '下・中', '下・右'];

// areaIndex（0〜8）からスペース上の相対座標（0〜1）を計算する
function areaToPosition(idx: number): { x: number; y: number } {
  const col = idx % 3;
  const row = Math.floor(idx / 3);
  const ranges = [
    { min: 0.05, max: 0.28 },
    { min: 0.38, max: 0.62 },
    { min: 0.72, max: 0.95 },
  ];
  const rand = (min: number, max: number) => (min + Math.random() * (max - min)) * 100;
  return { x: rand(ranges[col].min, ranges[col].max), y: rand(ranges[row].min, ranges[row].max) };
}

// F09: テキストから #タグ を抽出
// 全角 ＃ を半角 # に正規化してからマッチする
function parseHashtags(text: string): string[] {
  const normalized = text.replace(/＃/g, '#');
  const matches = normalized.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  return [...new Set(matches.map((t) => t.slice(1)))];
}

type Props = {
  panelMode?: 'side' | 'bottom';
  initialPosition?: { x: number; y: number };
  onClose?: () => void;
  /** 音声候補から開いたときのメッセージ初期値 */
  initialMessage?: string;
  /** 音声パネル候補の編集モード（保存 / 気持ちを置く） */
  speechEditMode?: boolean;
  /** 保存時に置換する元の候補文字列 */
  speechEditOriginal?: string;
  /** 保存: 候補テキストのみ更新（投稿しない） */
  onSaveSpeechDraft?: (originalCandidate: string, editedMessage: string) => void;
};

export const PostScreen = ({
  panelMode,
  initialPosition,
  onClose,
  initialMessage,
  speechEditMode,
  speechEditOriginal,
  onSaveSpeechDraft,
}: Props) => {
  const [selectedEmotion, setSelectedEmotion] = useState<EmotionKey | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [poyonActive, setPoyonActive] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [greeting, setGreeting] = useState('');

  // F01: 吹き出し色（テーマ + スウォッチ）。前回投稿の選択をローカルから復元
  const [selectedPaletteId, setSelectedPaletteId] = useState<BubblePaletteId>(
    () => loadPostBubbleColorDraft().paletteId
  );
  const [selectedColor, setSelectedColor] = useState<string | null>(() => loadPostBubbleColorDraft().color);
  const activeColors = useMemo(() => getBubblePalette(selectedPaletteId).colors, [selectedPaletteId]);

  const selectPalette = (id: BubblePaletteId) => {
    setSelectedPaletteId(id);
    const nextColors = getBubblePalette(id).colors;
    setSelectedColor((c) => (c != null && nextColors.includes(c) ? c : null));
  };

  // B02: 吹き出し形状
  const [selectedShape, setSelectedShape] = useState<string | null>(null);

  // F09: ハッシュタグ
  const [hashtagInput, setHashtagInput] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [selectedPresetTags, setSelectedPresetTags] = useState<string[]>([]);

  // F10: 画像投稿
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const messageTextareaRef = useRef<HTMLTextAreaElement>(null);
  const colorPaletteRef = useRef<HTMLDivElement>(null);
  const bubbleColorLabelId = useId();

  // F08: お絵描きモーダル
  const [showDrawingModal, setShowDrawingModal] = useState(false);

  // numberPost: 数値投稿
  const [numberInput, setNumberInput] = useState('');

  // 連続投稿モード
  const [continuousPost, setContinuousPost] = useState(() => loadContinuousPost());
  // await 後も最新のチェック状態で閉じる／遷移を判定する（画像アップロード待ち中に ON にした場合など）
  const continuousPostRef = useRef(continuousPost);
  continuousPostRef.current = continuousPost;

  // 位置選択グリッド（null = 未選択 = ランダム配置）
  const [selectedArea, setSelectedArea] = useState<number | null>(null);

  const { state, addHossii, getActiveSpace } = useHossiiStore();
  const { prefs: { showHossii } } = useDisplayPrefs();
  const { navigate } = useRouter();
  const { currentUser } = useAuth();
  const { flags: featureFlags } = useFeatureFlags(state.activeSpaceId ?? undefined);

  // スペース設定の読み込み
  const [spaceSettings, setSpaceSettings] = useState<SpaceSettings | null>(null);

  useEffect(() => {
    if (!featureFlags.position_selector) {
      setSelectedArea(null);
    }
  }, [featureFlags.position_selector]);

  useEffect(() => {
    setSelectedArea(null);
  }, [state.activeSpaceId]);

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

  // 音声候補から「編集」で開いたときメッセージを反映
  useEffect(() => {
    if (initialMessage !== undefined && initialMessage !== null) {
      setMessage(initialMessage);
    }
  }, [initialMessage]);

  // Toast自動消去
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // 投稿画面表示時はメッセージ欄にフォーカス（フルスクリーン・パネル共通。コメント無効時は textarea 非表示のためスキップ）
  useEffect(() => {
    if (spaceSettings?.features.commentPost === false) return;
    const id = requestAnimationFrame(() => {
      messageTextareaRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [spaceSettings?.features.commentPost]);

  // パネル: Esc で閉じる（お絵描きモーダル優先）
  useEffect(() => {
    if (!panelMode || !onClose) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showDrawingModal) return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [panelMode, onClose, showDrawingModal]);

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
    if (e.nativeEvent.isComposing) return;
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

      const positionGridActive = !panelMode && featureFlags.position_selector;
      const areaPos =
        panelMode && initialPosition
          ? initialPosition
          : positionGridActive && selectedArea !== null
            ? areaToPosition(selectedArea)
            : null;

      savePostBubbleColorDraft(selectedPaletteId, selectedColor);

      addHossii({
        message: message.trim(),
        emotion: selectedEmotion ?? undefined,
        bubbleColor: selectedColor ?? undefined,
        bubbleShapePng: selectedShape ?? undefined,
        hashtags: allHashtags.length > 0 ? allHashtags : undefined,
        tags: selectedPresetTags.length > 0 ? selectedPresetTags : undefined,
        imageUrl,
        numberValue: hasNumber ? parsedNumber! : undefined,
        positionX: areaPos?.x,
        positionY: areaPos?.y,
        isPositionFixed: !!areaPos,
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
          const on = continuousPostRef.current;
          const suffix = on ? ' 続けてどうぞ ⭐ スタンプ+1' : '〜！⭐ スタンプ+1';
          let toastMsg = `置いたよ${suffix}`;
          if (selectedEmotion) {
            const emoji = EMOJI_BY_EMOTION[selectedEmotion];
            const label = EMOTION_LABELS[selectedEmotion];
            toastMsg = `${emoji} ${label} を置いたよ！${on ? '続けてどうぞ ' : ''}⭐ スタンプ+1`;
          }
          setToast({ message: toastMsg, type: 'success' });
        }
      }

      // クリア（吹き出し色は前回どおり維持 — savePostBubbleColorDraft 済み）
      setSelectedEmotion(null);
      setMessage('');
      setSelectedShape(null);
      setHashtags([]);
      setHashtagInput('');
      setSelectedPresetTags([]);
      setNumberInput('');
      setSelectedArea(null);
      handleImageRemove();
      shuffleGreeting();

      if (panelMode) {
        if (!continuousPostRef.current) {
          // Toast を見せてから閉じる（即時クローズだと Toast が表示されない）
          setTimeout(() => onClose?.(), 700);
        } else if (spaceSettings?.features.commentPost !== false) {
          requestAnimationFrame(() => messageTextareaRef.current?.focus());
        }
      } else if (!continuousPostRef.current) {
        setTimeout(() => {
          navigate('screen');
        }, 800);
      }
    } finally {
      setSending(false);
    }
  };

  const canSubmit = selectedEmotion || message.trim() || imagePreview || numberInput.trim() !== '';

  const handleSubmitClick = () => {
    setPoyonActive(true);
    handleSubmit();
  };

  /** テキストエリア内: ⌘/Ctrl+Enter で投稿（改行は Enter のみ） */
  const handleMessageKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!sending && canSubmit) handleSubmitClick();
    }
  };

  /** 吹き出し色パレット: Tab で各スウォッチへ移動したあと、矢印/Home/End で隣へフォーカス移動 */
  const handleColorPaletteKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const el = e.target;
    if (!(el instanceof HTMLButtonElement)) return;
    const root = colorPaletteRef.current;
    if (!root?.contains(el)) return;
    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button[type="button"]'));
    const i = buttons.indexOf(el);
    if (i < 0) return;
    let next = i;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      next = Math.min(i + 1, buttons.length - 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      next = Math.max(i - 1, 0);
    } else if (e.key === 'Home') {
      e.preventDefault();
      next = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      next = buttons.length - 1;
    } else {
      return;
    }
    if (next !== i) buttons[next]?.focus();
  };

  const handleSaveSpeechDraftClick = () => {
    if (!onSaveSpeechDraft || speechEditOriginal === undefined) return;
    onSaveSpeechDraft(speechEditOriginal, message.trim());
    setToast({ message: '候補テキストを更新したよ', type: 'success' });
  };

  return (
    <div className={`${styles.container}${panelMode ? ` ${styles.panelContainer}` : ''}`}>
      {/* パネルモード: 閉じるボタン */}
      {panelMode && (
        <div className={styles.panelCloseBar}>
          <button
            type="button"
            onClick={onClose}
            className={styles.panelCloseButton}
            onPointerDown={(e) => e.stopPropagation()}
          >
            ✕ 閉じる
          </button>
        </div>
      )}

      {/* 右上メニュー（パネルモード時は非表示） */}
      {!panelMode && <TopRightMenu />}

      {/* ヘッダー：Hossii（showHossii時のみ・パネルモード時は非表示） */}
      {showHossii && !panelMode && (
        <header className={styles.header}>
          <HossiiMini onClick={shuffleGreeting} hossiiColor={spaceSettings?.hossiiColor} />
          <div className={styles.greetingArea}>
            <div className={styles.greeting}>{greeting}</div>
          </div>
        </header>
      )}

      {/* メインコンテンツ */}
      <main className={panelMode ? styles.panelMain : styles.main}>
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
          <div className={panelMode ? styles.panelSection : styles.section}>
            <div className={styles.label}>メッセージ</div>
            <textarea
              ref={messageTextareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleMessageKeyDown}
              placeholder="なんでも書いてね…（任意）"
              className={styles.textarea}
              maxLength={200}
              title={panelMode ? '⌘+Enter（Windows は Ctrl+Enter）で投稿' : undefined}
            />
          </div>
        )}

        {/* クイック感情バー - emotionPost が有効の場合のみ */}
        {spaceSettings?.features.emotionPost !== false && (
          <div className={panelMode ? styles.panelSection : styles.section}>
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

        {/* F01: 吹き出し色選択（4テーマ + デフォルト + 各8色）。フォーカス順はテーマ4→デフォルト→8色 */}
        <div className={panelMode ? styles.panelSection : styles.section}>
          <div className={styles.label} id={bubbleColorLabelId}>
            吹き出しの色（任意）
          </div>
          <div
            ref={colorPaletteRef}
            className={styles.colorPaletteToolbar}
            role="toolbar"
            aria-labelledby={bubbleColorLabelId}
            onKeyDown={handleColorPaletteKeyDown}
          >
            <div className={styles.paletteThemeRow} role="group" aria-label="色のテーマ">
              {BUBBLE_COLOR_PALETTES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`${styles.paletteThemeButton} ${
                    selectedPaletteId === p.id ? styles.paletteThemeButtonSelected : ''
                  }`}
                  style={{
                    background: `linear-gradient(135deg, ${p.previewStops[0]}, ${p.previewStops[1]}, ${p.previewStops[2]})`,
                  }}
                  onClick={() => selectPalette(p.id)}
                  title={p.label}
                  aria-label={`テーマ: ${p.label}`}
                  aria-pressed={selectedPaletteId === p.id}
                />
              ))}
            </div>
            <div className={styles.colorPaletteSwatchRow}>
              <button
                type="button"
                className={`${styles.colorSwatch} ${selectedColor === null ? styles.colorSwatchSelected : ''}`}
                style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)' }}
                onClick={() => setSelectedColor(null)}
                title="デフォルト"
                aria-label="デフォルト色"
                aria-pressed={selectedColor === null}
              />
              {activeColors.map((color) => (
                <button
                  key={`${selectedPaletteId}-${color}`}
                  type="button"
                  className={`${styles.colorSwatch} ${selectedColor === color ? styles.colorSwatchSelected : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setSelectedColor(selectedColor === color ? null : color)}
                  title={color}
                  aria-label={`色 ${color}`}
                  aria-pressed={selectedColor === color}
                />
              ))}
            </div>
          </div>
        </div>

        {/* B02: 吹き出し形状選択（bubble_shapes_extended が ON の場合のみ） */}
        {featureFlags.bubble_shapes_extended && (
          <div className={panelMode ? styles.panelSection : styles.section}>
            <div className={styles.label}>吹き出しの形（任意）</div>
            <div className={styles.shapePicker}>
              <button
                type="button"
                className={`${styles.shapeThumb} ${selectedShape === null ? styles.shapeThumbSelected : ''}`}
                onClick={() => setSelectedShape(null)}
                title="デフォルト"
                aria-label="デフォルト形状"
              >
                <span className={styles.shapeThumbDefault}>なし</span>
              </button>
              {BUBBLE_SHAPE_PRESETS.map((shape) => (
                <button
                  key={shape.path}
                  type="button"
                  className={`${styles.shapeThumb} ${selectedShape === shape.path ? styles.shapeThumbSelected : ''}`}
                  onClick={() => setSelectedShape(selectedShape === shape.path ? null : shape.path)}
                  title={shape.label}
                  aria-label={`形状: ${shape.label}`}
                >
                  <img src={shape.path} alt={shape.label} className={styles.shapeThumbImg} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* F09: ハッシュタグ */}
        <div className={panelMode ? styles.panelSection : styles.section}>
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
          <div className={panelMode ? styles.panelSection : styles.section}>
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
          <div className={panelMode ? styles.panelSection : styles.section}>
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

        {/* 位置選択グリッド（position_selector が ON かつフル画面時のみ。パネルはダブルクリック座標） */}
        {!panelMode && featureFlags.position_selector && (
          <div className={styles.section}>
            <div className={styles.label}>置く場所（任意）</div>
            <div className={styles.areaGrid}>
              {AREA_LABELS.map((label, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedArea(selectedArea === idx ? null : idx)}
                  className={`${styles.areaCell} ${selectedArea === idx ? styles.areaCellSelected : ''}`}
                  aria-label={label}
                  title={label}
                >
                  <span className={styles.areaCellLabel}>{label}</span>
                </button>
              ))}
            </div>
            <div className={styles.areaHint}>
              {selectedArea !== null
                ? `選択中: ${AREA_LABELS[selectedArea]}`
                : 'スペース全体にランダム配置'}
            </div>
          </div>
        )}

        {/* 送信ボタン（音声候補編集時は 保存 + 気持ちを置く） */}
        {speechEditMode && panelMode ? (
          <div className={styles.speechEditActions}>
            <button
              type="button"
              onClick={handleSaveSpeechDraftClick}
              disabled={sending}
              className={styles.saveDraftButton}
            >
              保存
            </button>
            <button
              type="button"
              onClick={handleSubmitClick}
              onAnimationEnd={() => setPoyonActive(false)}
              disabled={sending || !canSubmit}
              className={`${styles.submitButton} ${styles.submitButtonHalf}${poyonActive ? ` ${styles.submitButtonPoyon}` : ''}`}
              title="⌘+Enter（Windows は Ctrl+Enter）でも投稿できます"
            >
              {sending ? (
                '送信中...'
              ) : (
                <span className={styles.submitButtonInner}>
                  <span className={styles.submitButtonLabel}>気持ちを置く</span>
                  <span className={styles.submitShortcutSep} aria-hidden="true">
                    ·
                  </span>
                  <span className={styles.submitShortcutHint} aria-hidden="true">
                    ⌘/⌃↵
                  </span>
                </span>
              )}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleSubmitClick}
            onAnimationEnd={() => setPoyonActive(false)}
            disabled={sending || !canSubmit}
            className={`${styles.submitButton}${poyonActive ? ` ${styles.submitButtonPoyon}` : ''}`}
            title="⌘+Enter（Windows は Ctrl+Enter）でも投稿できます"
          >
            {sending ? (
              '送信中...'
            ) : (
              <span className={styles.submitButtonInner}>
                <span className={styles.submitButtonLabel}>気持ちを置く</span>
                <span className={styles.submitShortcutSep} aria-hidden="true">
                  ·
                </span>
                <span className={styles.submitShortcutHint} aria-hidden="true">
                  ⌘/⌃↵
                </span>
              </span>
            )}
          </button>
        )}

        {/* 連続投稿チェックボックス（音声候補編集時は非表示） */}
        {!(speechEditMode && panelMode) && (
          <label className={styles.continuousPostLabel}>
            <input
              type="checkbox"
              checked={continuousPost}
              onChange={(e) => {
                const v = e.target.checked;
                continuousPostRef.current = v;
                setContinuousPost(v);
                saveContinuousPost(v);
              }}
              className={styles.continuousPostCheckbox}
            />
            連続で気持ちを置く
          </label>
        )}
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
