import { useEffect, useRef, useCallback, useState } from 'react';
import type { EmotionKey, LanguageCode } from '../types';

export type AudioEvent = {
  type: 'laugh' | 'loud' | 'silence';
  emotion: EmotionKey;
  message: string;
  language: LanguageCode;
};

type UseAudioListenerOptions = {
  enabled: boolean;
  onAudioEvent: (event: AudioEvent) => void;
};

// 検知パラメータ
const SILENCE_THRESHOLD = 0.02; // 無音判定閾値
const LOUD_THRESHOLD = 0.5; // 大きな音の閾値
const LAUGH_THRESHOLD = 0.15; // 笑い声判定閾値（中程度の音量）
const SILENCE_DURATION = 8000; // 無音継続時間（8秒）
const COOLDOWN = 5000; // 投稿クールダウン（5秒）

// 定型文（バイリンガル対応）
const LAUGH_MESSAGES = {
  ja: ['（笑い声が聞こえた）', '（みんな笑ってる）', '（楽しそうな声）'],
  en: ['(heard laughter)', '(everyone is laughing)', '(sounds of fun)'],
};

const LOUD_MESSAGES = {
  ja: ['（大きな音がした）', '（わっ！びっくり）', '（何か起きた？）'],
  en: ['(loud sound)', '(whoa! startled)', '(what happened?)'],
};

const SILENCE_MESSAGES = {
  ja: ['（静かな時間…）', '（しーん…）', '（穏やかな空気）'],
  en: ['(quiet time...)', '(silence...)', '(peaceful atmosphere)'],
};

// calm は EmotionKey に存在しないので think を代用
const SILENCE_EMOTION: EmotionKey = 'think';

function getRandomMessage(
  messages: { ja: string[]; en: string[] },
  language: LanguageCode
): string {
  const langMessages = language === 'en' ? messages.en : messages.ja;
  return langMessages[Math.floor(Math.random() * langMessages.length)];
}

export function useAudioListener({ enabled, onAudioEvent }: UseAudioListenerOptions) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const lastEventTimeRef = useRef<number>(0);
  const silenceStartRef = useRef<number | null>(null);
  const volumeHistoryRef = useRef<number[]>([]);

  // オーディオ分析ループ
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    // RMS（二乗平均平方根）で音量を計算
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = dataArray[i] / 255;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / dataArray.length);

    const now = Date.now();
    const timeSinceLastEvent = now - lastEventTimeRef.current;

    // 音量履歴を保持（笑い声パターン検出用）
    volumeHistoryRef.current.push(rms);
    if (volumeHistoryRef.current.length > 60) {
      volumeHistoryRef.current.shift();
    }

    // クールダウン中はイベント発火しない
    if (timeSinceLastEvent < COOLDOWN) {
      animationFrameRef.current = requestAnimationFrame(analyzeAudio);
      return;
    }

    // 大きな音の検出
    if (rms > LOUD_THRESHOLD) {
      lastEventTimeRef.current = now;
      silenceStartRef.current = null;
      onAudioEvent({
        type: 'loud',
        emotion: 'wow',
        message: getRandomMessage(LOUD_MESSAGES, 'ja'),
        language: 'ja',
      });
    }
    // 笑い声パターンの検出（中程度の音量が断続的に続く）
    else if (rms > LAUGH_THRESHOLD && detectLaughPattern()) {
      lastEventTimeRef.current = now;
      silenceStartRef.current = null;
      onAudioEvent({
        type: 'laugh',
        emotion: 'laugh',
        message: getRandomMessage(LAUGH_MESSAGES, 'ja'),
        language: 'ja',
      });
    }
    // 無音の検出
    else if (rms < SILENCE_THRESHOLD) {
      if (silenceStartRef.current === null) {
        silenceStartRef.current = now;
      } else if (now - silenceStartRef.current > SILENCE_DURATION) {
        lastEventTimeRef.current = now;
        silenceStartRef.current = null;
        onAudioEvent({
          type: 'silence',
          emotion: SILENCE_EMOTION,
          message: getRandomMessage(SILENCE_MESSAGES, 'ja'),
          language: 'ja',
        });
      }
    } else {
      // 音があれば無音タイマーリセット
      silenceStartRef.current = null;
    }

    animationFrameRef.current = requestAnimationFrame(analyzeAudio);
  }, [onAudioEvent]);

  // 笑い声パターン検出（音量の変動が激しい）
  const detectLaughPattern = useCallback(() => {
    const history = volumeHistoryRef.current;
    if (history.length < 30) return false;

    // 直近30フレームの分散を計算
    const recent = history.slice(-30);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const variance = recent.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / recent.length;

    // 分散が大きい = 音量の変動が激しい = 笑い声の可能性
    return variance > 0.005 && avg > LAUGH_THRESHOLD * 0.5;
  }, []);

  // マイク開始
  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;

      source.connect(analyser);
      analyserRef.current = analyser;

      setIsListening(true);
      setError(null);

      // 分析ループ開始
      analyzeAudio();
    } catch (err) {
      setError('マイクへのアクセスが拒否されました');
      setIsListening(false);
    }
  }, [analyzeAudio]);

  // マイク停止
  const stopListening = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    silenceStartRef.current = null;
    volumeHistoryRef.current = [];
    setIsListening(false);
  }, []);

  // enabled の変化に応じてマイクを開始/停止
  useEffect(() => {
    if (enabled) {
      startListening();
    } else {
      stopListening();
    }

    return () => {
      stopListening();
    };
  }, [enabled, startListening, stopListening]);

  return {
    isListening,
    error,
  };
}
