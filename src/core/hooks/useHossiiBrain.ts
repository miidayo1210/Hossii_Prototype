import { useState, useEffect, useCallback, useRef } from 'react';

export type HossiiBrainMessage = {
  text: string;
  timestamp: number;
};

// 独り言のプール
const IDLE_TALKS = {
  morning: [
    'おはよう！今日もいい日になりそうだね ☀️',
    'きょうの宇宙、きれいだな〜',
    '朝の光が気持ちいい〜',
  ],
  afternoon: [
    'きょうの宇宙、きれいだな〜',
    '誰か来ないかな？',
    'ふわふわ〜',
    'ぽかぽかだね〜',
  ],
  evening: [
    '夕焼けがきれいだよ 🌆',
    'そろそろ夜だね〜',
    '今日はどうだった？',
  ],
  night: [
    '星がきれいだね ⭐',
    'そろそろ眠いかも…',
    '夜の静けさが心地いいね',
    'おやすみの時間かな？',
  ],
};

// 時刻に応じた独り言を取得
const getIdleTalkPool = (): string[] => {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return IDLE_TALKS.morning;
  } else if (hour >= 12 && hour < 17) {
    return IDLE_TALKS.afternoon;
  } else if (hour >= 17 && hour < 20) {
    return IDLE_TALKS.evening;
  } else {
    return IDLE_TALKS.night;
  }
};

// キーワード反応マップ
const KEYWORD_REACTIONS: Array<{ keywords: string[]; responses: string[] }> = [
  {
    keywords: ['疲れ', 'つかれ', 'しんどい', 'きつい'],
    responses: [
      'おつかれさま！ゆっくり休んでね 💤',
      'ゆっくり休んで、元気になってね！',
      '無理しないでね〜',
    ],
  },
  {
    keywords: ['嬉しい', 'うれしい', '楽しい', 'たのしい', 'ハッピー', '最高'],
    responses: [
      'えへへ、よかったね！✨',
      'わーい！一緒に喜んじゃう！',
      'その調子だよ〜！',
    ],
  },
  {
    keywords: ['眠い', 'ねむい', '寝る', 'おやすみ'],
    responses: [
      'おやすみ〜💤',
      'いい夢見てね！',
      'ゆっくり休んでね〜',
    ],
  },
  {
    keywords: ['ありがとう', 'ありがと', 'サンキュー'],
    responses: [
      'どういたしまして！✨',
      'えへへ、喜んでもらえて嬉しいな',
      'いつでも力になるよ！',
    ],
  },
  {
    keywords: ['悲しい', 'かなしい', 'つらい', '辛い', '泣き'],
    responses: [
      'そっか…大丈夫、そばにいるよ',
      'つらい時は泣いていいんだよ',
      'ゆっくりでいいから、前を向こうね',
    ],
  },
  {
    keywords: ['おはよう', 'おはー'],
    responses: [
      'おはよう！今日もいい日にしようね！',
      'おはよう〜！元気？',
    ],
  },
];

// 汎用的な相槌
const GENERIC_RESPONSES = [
  'なるほど〜',
  'ほうほう',
  'そうなんだね！',
  'わかるよ〜',
  'ふむふむ',
  'いいね！',
];

type Props = {
  enabled: boolean; // 音声ON/OFF
  onMessage?: (message: HossiiBrainMessage) => void;
};

export const useHossiiBrain = ({ enabled, onMessage }: Props) => {
  const [currentMessage, setCurrentMessage] = useState<HossiiBrainMessage | null>(null);
  const idleTalkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasShownWelcomeRef = useRef(false);

  // メッセージを発言
  const speak = useCallback((text: string) => {
    const message: HossiiBrainMessage = {
      text,
      timestamp: Date.now(),
    };
    setCurrentMessage(message);
    onMessage?.(message);

    // 5秒後に自動で消す
    setTimeout(() => {
      setCurrentMessage(null);
    }, 5000);
  }, [onMessage]);

  // ウェルカムメッセージ
  useEffect(() => {
    if (enabled && !hasShownWelcomeRef.current) {
      hasShownWelcomeRef.current = true;

      const welcomeMessages = [
        'おかえり！待ってたよ！',
        'やっほー！今日も一緒に過ごそうね',
        'おかえりなさい ✨',
      ];

      const randomWelcome = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];

      setTimeout(() => {
        speak(randomWelcome);
      }, 2000); // 2秒後に表示
    }
  }, [enabled, speak]);

  // 独り言タイマー
  const scheduleIdleTalk = useCallback(() => {
    if (!enabled) return;

    // 30秒〜60秒のランダムな間隔
    const delay = 30000 + Math.random() * 30000;

    idleTalkTimerRef.current = setTimeout(() => {
      const pool = getIdleTalkPool();
      const randomTalk = pool[Math.floor(Math.random() * pool.length)];
      speak(randomTalk);

      // 次の独り言をスケジュール
      scheduleIdleTalk();
    }, delay);
  }, [enabled, speak]);

  // 独り言タイマーの開始
  useEffect(() => {
    if (enabled) {
      scheduleIdleTalk();
    }

    return () => {
      if (idleTalkTimerRef.current) {
        clearTimeout(idleTalkTimerRef.current);
      }
    };
  }, [enabled, scheduleIdleTalk]);

  // 投稿への反応
  const reactToPost = useCallback((message: string) => {
    if (!enabled) return;

    // キーワードマッチング
    for (const reaction of KEYWORD_REACTIONS) {
      for (const keyword of reaction.keywords) {
        if (message.includes(keyword)) {
          const randomResponse = reaction.responses[
            Math.floor(Math.random() * reaction.responses.length)
          ];
          speak(randomResponse);
          return;
        }
      }
    }

    // キーワードに該当しない場合は汎用的な相槌
    const randomGeneric = GENERIC_RESPONSES[
      Math.floor(Math.random() * GENERIC_RESPONSES.length)
    ];
    speak(randomGeneric);
  }, [enabled, speak]);

  return {
    currentMessage,
    reactToPost,
    speak,
  };
};
