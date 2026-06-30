# EmotionPicker (baseline, without skill)

投稿前に気持ちを選ぶための React コンポーネントです。

## ファイル

| ファイル | 内容 |
| --- | --- |
| `EmotionPicker.tsx` | 8種類の感情を選べるピッカー本体 |
| `EmotionPicker.module.css` | CSS Modules スタイル |

## 機能

- **8種類の感情**: `joy`, `wow`, `think`, `empathy`, `inspire`, `laugh`, `moved`, `fun`
- 各ボタンに絵文字と日本語ラベル（例: うれしい、Wow、気になる）
- **制御 / 非制御**の両対応（`value` + `onChange` または `defaultValue`）
- 同じ感情を再クリックで選択解除（`allowDeselect={false}` で無効化可能）
- `role="radiogroup"` / `role="radio"` による基本的なアクセシビリティ
- 選択中の感情を下部ヒントで表示（`showHint={false}` で非表示）

## 使用例

```tsx
import { useState } from 'react';
import { EmotionPicker, type EmotionKey } from './EmotionPicker';

function PostForm() {
  const [emotion, setEmotion] = useState<EmotionKey | null>(null);

  return (
    <EmotionPicker
      value={emotion}
      onChange={setEmotion}
      label="気持ちをつける"
      required
    />
  );
}
```

## 設計メモ

- Hossii 本体の `PostScreen` にある感情キー・ラベル・絵文字定義に合わせて定数を内包しています。
- 4列グリッド（モバイルは2列）のカード型 UI。選択状態は青系のボーダーと背景で表現しています。
