// 吹き出し形状プリセット
// public/assets/bubble-shapes/ にPNGファイルを格納することで有効になる
// PNG仕様: 透明な部分が切り抜き、不透明な部分（alphaチャンネルのみでOK）が表示領域になる

export type BubbleShapeKey = string; // ファイル名（例: "speech.png"）

export type BubbleShapePreset = {
  key: BubbleShapeKey;
  label: string;
  path: string; // public/ 以下のパス
};

// プリセット形状リスト
// PNG格納後にここに追加してください
export const BUBBLE_SHAPE_PRESETS: BubbleShapePreset[] = [
  // 例: { key: 'speech.png', label: '吹き出し（丸型）', path: '/assets/bubble-shapes/speech.png' },
  // 例: { key: 'cloud.png',  label: '雲型',           path: '/assets/bubble-shapes/cloud.png' },
];
