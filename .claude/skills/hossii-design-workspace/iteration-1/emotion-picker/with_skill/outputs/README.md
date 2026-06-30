# EmotionPicker

投稿前に8種類の気持ちを選ぶコンシューマー向け UI コンポーネント。

## ファイル構成

| ファイル | 役割 |
|---|---|
| `EmotionPicker.tsx` | メインコンポーネント |
| `EmotionPicker.module.css` | CSS Modules スタイル |
| `emotionPickerConfig.ts` | 8感情の表示順・日本語ラベル |

## デザイン判断

- **文脈**: コンシューマー（投稿フォーム）。フロストガラス + 紫ピンクグラデーション。
- **8感情**: `EmotionKey` 全種（`joy`, `wow`, `think`, `empathy`, `inspire`, `laugh`, `moved`, `fun`）。
- **カラー**: `emotionColors.ts` の `--emotion-color` を選択リングに使用。
- **形状**: 各チップはピル形状（`border-radius: 9999px`）。
- **アニメーション**: タップ時 `hossii-pop`、選択ヒント `hossii-soft-bounce` + `hossii-sparkle`（`motion.css` グローバルクラス）。
- **コピー**: 「気持ちを選ぶ」「気持ちを置く」など Hossii 語彙。

## 使い方

```tsx
import { useState } from 'react';
import type { EmotionKey } from '@/core/types';
import { EmotionPicker } from './EmotionPicker';

function PostForm() {
  const [emotion, setEmotion] = useState<EmotionKey | null>(null);

  return (
    <EmotionPicker
      value={emotion}
      onChange={setEmotion}
      required
      showHint
    />
  );
}
```

`src/core/ui/motion.css` がアプリに読み込まれている前提です（既存の `index.css` / エントリ経由）。

## Props

| Prop | 型 | デフォルト | 説明 |
|---|---|---|---|
| `value` | `EmotionKey \| null` | — | 選択中の感情 |
| `onChange` | `(emotion) => void` | — | 選択変更（再タップで解除） |
| `label` | `string` | `'気持ちを選ぶ'` | 見出し |
| `required` | `boolean` | `false` | 必須バッジ表示 |
| `showHint` | `boolean` | `true` | 選択ヒント行 |
| `error` | `boolean` | `false` | エラー枠 |
| `errorMessage` | `string` | `'気持ちを選んでください'` | エラーメッセージ |
| `className` | `string` | — | ルート追加クラス |

## プロジェクトへの組み込み

本出力は eval 用ワークスペースです。本番利用時は `src/components/PostScreen/` など適切な場所へ移し、import パスを `@/` または相対パスに合わせてください。
