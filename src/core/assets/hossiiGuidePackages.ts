/** 目的別ガイドパッケージ key（117 仕様 10.3） */
export type HossiiGuidePackageKey =
  | 'reflection'
  | 'ideas'
  | 'small_step'
  | 'gratitude'
  | 'dialogue'
  | 'event_feedback'
  | 'team_progress'
  | 'next_action';

export type HossiiGuidePackageMeta = {
  key: HossiiGuidePackageKey;
  /** 管理 UI 表示名（利用者には表示しない） */
  label: string;
  messages: readonly string[];
};

export const HOSSII_GUIDE_PACKAGES: readonly HossiiGuidePackageMeta[] = [
  {
    key: 'reflection',
    label: '振り返りを促す',
    messages: [
      '今日、印象に残ったことは？',
      '小さな気づきも置いてみよう',
      '次に試したいことはある？',
      '今日の自分にひとこと残してみよう',
      'うまくいったこと、ひとつだけでも教えて',
    ],
  },
  {
    key: 'ideas',
    label: 'アイデアを集める',
    messages: [
      '今ひらめいたことを、そのまま置いてみよう',
      'まだ形になっていないアイデアでも大丈夫',
      '他の人の投稿を見て、思いついたことを足してみよう',
      '「もし〜だったら」という問い、ある？',
      'この場所では、みんなの“やってみたい”を集めています',
    ],
  },
  {
    key: 'small_step',
    label: '今日の一歩を記録する',
    messages: [
      '今日気づいたことを、ひとつ置いてみよう',
      '小さな一歩でも大丈夫。今日やったことを残してみよう',
      '今日はどんな一歩があった？',
      'できたこと、小さくても記録に残そう',
      '今日の一歩を、言葉にしてみよう',
    ],
  },
  {
    key: 'gratitude',
    label: '感謝を伝える',
    messages: [
      '誰かに伝えたい“ありがとう”はある？',
      '今日助けてくれた人へのひとことを残してみよう',
      'うれしかったことを、ひとこと共有してみよう',
      '感謝の気持ちを、言葉にして置いてみよう',
      'ちょっとしたありがとうでも、残してみよう',
    ],
  },
  {
    key: 'dialogue',
    label: '対話を生む',
    messages: [
      'ほかの人の投稿で気になったものはあった？',
      '気になる投稿に、ひとこと返してみよう',
      '違う意見があっても大丈夫。思ったことを置いてみよう',
      '誰かの投稿を読んで、もう一度投稿してみよう',
      'みんなの声を見て、自分の考えも足してみよう',
    ],
  },
  {
    key: 'event_feedback',
    label: 'イベントの感想を集める',
    messages: [
      '今日のイベントで印象に残ったことは？',
      'いちばん心に残った場面を教えて',
      'また参加したいと思った瞬間はあった？',
      '今日の学びを、ひとことで残してみよう',
      'イベントの感想を、気軽に置いてみよう',
    ],
  },
  {
    key: 'team_progress',
    label: 'チームの進捗を共有する',
    messages: [
      '今週の進捗を、ひとこと共有してみよう',
      'チームとして進んだことを残してみよう',
      '困っていること、あれば置いてみよう',
      '次の一週間でやることを書いてみよう',
      '小さな前進でも、みんなに知らせよう',
    ],
  },
  {
    key: 'next_action',
    label: '次のアクションを考える',
    messages: [
      '次にやること、ひとつ決めてみよう',
      '今日決めたことを、メモのように残してみよう',
      '来週の自分へのメッセージを置いてみよう',
      '次の一歩は何にする？',
      'やることリストの最初の1件、書いてみよう',
    ],
  },
] as const;

const packageByKey = new Map<string, HossiiGuidePackageMeta>(
  HOSSII_GUIDE_PACKAGES.map((pkg) => [pkg.key, pkg]),
);

/** packageKey がコード定義に存在するか */
export function isKnownHossiiGuidePackageKey(key: string | undefined | null): key is HossiiGuidePackageKey {
  return typeof key === 'string' && packageByKey.has(key);
}

/** パッケージ key からメッセージ配列を解決。不明 key は空配列 */
export function resolvePackageMessages(packageKey: string | undefined | null): string[] {
  if (!isKnownHossiiGuidePackageKey(packageKey)) {
    return [];
  }
  const pkg = packageByKey.get(packageKey);
  return pkg ? [...pkg.messages] : [];
}

/** 管理 UI 用: パッケージ一覧 */
export function listHossiiGuidePackages(): readonly HossiiGuidePackageMeta[] {
  return HOSSII_GUIDE_PACKAGES;
}
