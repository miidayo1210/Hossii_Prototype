# NewHossiiArrivalToast

スペース画面で**新しい Hossii（気持ち）が届いたとき**に表示するトースト通知コンポーネント。

## 文脈

- **コンシューマー（体験）** UI — フロストガラス + 紫ピンクグラデーション
- 既存の `HossiiToast`（成功/エラー/情報向けピル型）とは別物。感情・作者・メッセージの断片を伝える

## ファイル

| ファイル | 内容 |
|---|---|
| `NewHossiiArrivalToast.tsx` | React コンポーネント |
| `NewHossiiArrivalToast.module.css` | CSS Modules（グラス + アニメーション） |

## デザイン判断

- **グラスモーフィズム**: `rgba(255,255,255,0.88)` + `blur(12px)`、左端にブランドグラデーションのアクセントバー
- **コピー**: 「新しい気持ちが届いた」/「〇〇さんの気持ちが届いた」（Hossii 用語。通知・投稿などは使わない）
- **感情**: `emotion` に応じた絵文字バッジ + 感情カラー（`emotionColors.ts` と同値）
- **アニメーション**: `hossii-soft-bounce`・`hossii-sparkle`（`motion.css` 準拠）+ 入退場用 `hossii-arrival-*`
- **`prefers-reduced-motion`**: アニメーション無効化、フェードのみ

## 使い方（例）

```tsx
const [toastHossii, setToastHossii] = useState<NewHossiiArrivalPayload | null>(null);
const [showToast, setShowToast] = useState(false);

// 新着検知時
setToastHossii({
  id: hossii.id,
  authorName: hossii.authorName,
  message: hossii.message,
  emotion: hossii.emotion,
});
setShowToast(true);

<NewHossiiArrivalToast
  hossii={toastHossii}
  show={showToast}
  onClose={() => setShowToast(false)}
/>
```

## 本番統合時

- `src/core/ui/` に配置し、型は `EmotionKey` / `EMOJI_BY_EMOTION` / `getEmotionColor` を `src/core` から import
- グローバル `motion.css` を読み込んでいれば、CSS Module 内の keyframes 重複は削除可能
