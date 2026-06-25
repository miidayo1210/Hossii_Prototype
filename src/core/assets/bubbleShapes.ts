// 吹き出し形状プリセット
// public/assets/bubble-shapes/ にPNGファイルを格納することで有効になる
// PNG仕様: 透明な部分が切り抜き、不透明な部分（alphaチャンネルのみでOK）が表示領域になる

export type BubbleShapeKey = string;

export type BubbleShapePreset = {
  key: BubbleShapeKey;
  label: string;
  path: string;
};

export const BUBBLE_SHAPE_PRESETS: BubbleShapePreset[] = [
  { key: 'heart', label: 'ハート', path: '/assets/bubble-shapes/Hossiiコメ枠ハート.png' },
  { key: 'cloud', label: '雲', path: '/assets/bubble-shapes/Hossiiコメ枠雲.png' },
  { key: 'balloon', label: '風船', path: '/assets/bubble-shapes/Hossiiコメ枠風船.png' },
  { key: 'leaf', label: '葉っぱ', path: '/assets/bubble-shapes/Hossiiコメ枠葉っぱ.png' },
  { key: 'drop', label: '雫', path: '/assets/bubble-shapes/Hossiiコメ枠雫.png' },
  { key: 'sticky', label: '付箋', path: '/assets/bubble-shapes/Hossiiコメ枠付箋小.png' },
  { key: 'memo', label: 'メモ', path: '/assets/bubble-shapes/Hossiiコメ枠メモ大.png' },
  { key: 'cat', label: 'ネコ', path: '/assets/bubble-shapes/Hossiiコメ枠ネコ.png' },
  { key: 'goldfish', label: '金魚', path: '/assets/bubble-shapes/Hossiiコメ枠金魚.png' },
  { key: 'dolphin', label: 'いるか', path: '/assets/bubble-shapes/Hossiiコメ枠いるか.png' },
  { key: 'ginkgo', label: 'イチョウ', path: '/assets/bubble-shapes/Hossiiコメ枠イチョウ.png' },
  { key: 'bat', label: 'コウモリ', path: '/assets/bubble-shapes/Hossiiコメ枠コウモリ.png' },
  { key: 'ema', label: '絵馬', path: '/assets/bubble-shapes/Hossiiコメ枠絵馬.png' },
  { key: 'airplane', label: '紙ひこうき', path: '/assets/bubble-shapes/Hossiiコメ枠紙ひこうき.png' },
];
