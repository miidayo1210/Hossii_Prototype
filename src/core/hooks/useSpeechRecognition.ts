import { useEffect, useRef, useCallback, useState } from 'react';
import type { SpeechLevel, LanguageCode } from '../types';
import type { SpeechLevelSettings } from '../utils/listenStorage';
import { detectLanguage } from '../utils/languageDetection';

export type SpeechEvent = {
  text: string;
  level: SpeechLevel;
  language: LanguageCode;
};

type UseSpeechRecognitionOptions = {
  enabled: boolean;
  speechLevels: SpeechLevelSettings;
  onSpeechEvent: (event: SpeechEvent) => void;
};

// 設定パラメータ
const SILENCE_FLUSH_DELAY = 2500; // 無音後のフラッシュ遅延（2.5秒）
const MAX_BUFFER_LENGTH = 120; // バッファの最大文字数
const MIN_FLUSH_INTERVAL = 15000; // 最小フラッシュ間隔（15秒）
const MIN_WORD_LENGTH = 3; // 最小単語長（2文字以下は除去）

// 粒度判定（言語に応じた判定）
function classifySpeechLevel(text: string, language: LanguageCode): SpeechLevel {
  if (language === 'en') {
    // 英語: 単語数ベースの判定
    const wordCount = text.trim().split(/\s+/).length;
    if (wordCount <= 3) return 'word';
    if (wordCount <= 10) return 'short';
    return 'long';
  } else {
    // 日本語 & その他: 文字数ベースの判定
    const length = text.length;
    if (length <= 10) return 'word';
    if (length <= 30) return 'short';
    return 'long';
  }
}

// ノイズフィルタ：フィラーや短すぎる単語を除去（バイリンガル対応）
const FILLER_PATTERNS_JA = [
  /^(あー|えー|うー|んー|あの|えっと|まあ|ま|ね|さ)$/,
  /^[あいうえおんー]{1,2}$/,
];

const FILLER_PATTERNS_EN = [
  /^(uh|um|er|ah|hmm|like|you know)$/i,
  /^[a-z]{1,2}$/i,
];

function isNoise(text: string, language: LanguageCode): boolean {
  const trimmed = text.trim();
  if (trimmed.length <= MIN_WORD_LENGTH - 1) return true;

  const patterns = language === 'en' ? FILLER_PATTERNS_EN : FILLER_PATTERNS_JA;
  return patterns.some((pattern) => pattern.test(trimmed));
}

// SpeechRecognition の型定義（Web Speech API）
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event & { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

export function useSpeechRecognition({
  enabled,
  speechLevels,
  onSpeechEvent,
}: UseSpeechRecognitionOptions) {
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const bufferRef = useRef<string>('');
  const lastTextRef = useRef<string>('');
  const lastFlushTimeRef = useRef<number>(0);
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechLevelsRef = useRef(speechLevels);

  // speechLevels を ref で保持
  speechLevelsRef.current = speechLevels;

  // バッファをフラッシュ
  const flushBuffer = useCallback(() => {
    const text = bufferRef.current.trim();
    if (!text) return;

    const now = Date.now();
    const timeSinceLastFlush = now - lastFlushTimeRef.current;

    // レート制限
    if (timeSinceLastFlush < MIN_FLUSH_INTERVAL) {
      return;
    }

    // 重複チェック
    if (text === lastTextRef.current) {
      bufferRef.current = '';
      return;
    }

    // 言語検出
    const detectedLanguage = detectLanguage(text);

    // 粒度判定（言語を考慮）
    const level = classifySpeechLevel(text, detectedLanguage);

    // 設定で有効な粒度かチェック
    if (!speechLevelsRef.current[level]) {
      bufferRef.current = '';
      return;
    }

    // イベント発火（言語情報を含む）
    onSpeechEvent({ text, level, language: detectedLanguage });
    lastTextRef.current = text;
    lastFlushTimeRef.current = now;
    bufferRef.current = '';
  }, [onSpeechEvent]);

  // 認識結果を処理
  const handleResult = useCallback(
    (event: SpeechRecognitionEvent) => {
      // タイムアウトをリセット
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
        flushTimeoutRef.current = null;
      }

      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        }
      }

      if (finalTranscript) {
        // 言語を検出してノイズフィルタを適用
        const detectedLanguage = detectLanguage(finalTranscript);
        if (!isNoise(finalTranscript, detectedLanguage)) {
          bufferRef.current += finalTranscript;

          // バッファが上限に達したらフラッシュ
          if (bufferRef.current.length >= MAX_BUFFER_LENGTH) {
            flushBuffer();
          }
        }
      }

      // 無音検出用タイムアウトを設定
      flushTimeoutRef.current = setTimeout(() => {
        flushBuffer();
      }, SILENCE_FLUSH_DELAY);
    },
    [flushBuffer]
  );

  // 音声認識を開始
  const startRecognition = useCallback(() => {
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setError('お使いのブラウザは音声認識に対応していません');
      return;
    }

    try {
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'ja-JP';

      recognition.onresult = handleResult;

      recognition.onerror = (event) => {
        if (event.error === 'no-speech') {
          // 無音は無視
          return;
        }
        setError(`音声認識エラー: ${event.error}`);
      };

      recognition.onend = () => {
        // 自動再開（enabled の場合）
        if (enabled && recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch {
            // すでに開始している場合は無視
          }
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsRecognizing(true);
      setError(null);
    } catch (err) {
      setError('音声認識の開始に失敗しました');
      setIsRecognizing(false);
    }
  }, [enabled, handleResult]);

  // 音声認識を停止
  const stopRecognition = useCallback(() => {
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }

    if (recognitionRef.current) {
      recognitionRef.current.onend = null; // 自動再開を防ぐ
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }

    // 残りのバッファをフラッシュ
    flushBuffer();

    bufferRef.current = '';
    setIsRecognizing(false);
  }, [flushBuffer]);

  // enabled の変化に応じて認識を開始/停止
  useEffect(() => {
    if (enabled) {
      startRecognition();
    } else {
      stopRecognition();
    }

    return () => {
      stopRecognition();
    };
  }, [enabled, startRecognition, stopRecognition]);

  return {
    isRecognizing,
    error,
  };
}
