# SpaceWelcomeBanner

スペース画面上部向けの、初めて来たユーザーへの案内バナー（eval 出力）。

## 概要

`SpaceWelcomeBanner` は **コンシューマー文脈** の Hossii デザイン言語に沿ったフロストガラスバナーです。スペース名をグラデーション見出しで歓迎し、温かい日本語コピーで「気持ちを置く」体験を案内します。

## デザイン判断

| 項目 | 採用 |
|------|------|
| 文脈 | コンシューマー（体験） |
| カード | `rgba(255,255,255,0.88)` + `blur(12px)` の標準グラス |
| 主色 | `#a855f7` → `#ec4899` グラデーション |
| 形状 | ピル CTA（`border-radius: 9999px`）、角丸 1rem カード |
| アニメ | 出現 `hossii-soft-bounce`、マスコット `hossii-float-slow` |
| コピー | 「気持ちを置く」「あとで」（一般的な「投稿する」「閉じる」を回避） |

## ファイル

- `SpaceWelcomeBanner.tsx` — コンポーネント本体
- `SpaceWelcomeBanner.module.css` — CSS Modules スタイル

## Props

| Prop | 型 | 説明 |
|------|-----|------|
| `spaceId` | `string` | localStorage キー用 ID |
| `spaceName` | `string` | 見出しに表示するスペース名 |
| `forceVisible` | `boolean?` | 初回判定を上書きして強制表示 |
| `onPostClick` | `() => void?` | CTA「気持ちを置いてみる」押下時 |
| `onDismiss` | `() => void?` | 閉じたあと |
| `topOffset` | `string?` | TopBar 下の位置（既定 `4.5rem`） |

## 初回表示ロジック

`localStorage` キー `hossii:space-welcome-dismissed:{spaceId}` でスペース単位の dismiss を記憶します。「あとで」または × で閉じると再表示しません。

## SpaceScreen への組み込み例

```tsx
import { SpaceWelcomeBanner } from './SpaceWelcomeBanner';

<SpaceWelcomeBanner
  spaceId={activeSpace.id}
  spaceName={activeSpace.name}
  onPostClick={() => setQuickPostOpen(true)}
/>
```

`src/core/ui/motion.css` がグローバルに読み込まれている前提で `hossii-soft-bounce` / `hossii-float-slow` を利用しています。

## アクセシビリティ

- `role="region"` + `aria-label`
- 閉じるボタンに `aria-label="案内を閉じる"`
- `prefers-reduced-motion: reduce` でアニメーション無効化
