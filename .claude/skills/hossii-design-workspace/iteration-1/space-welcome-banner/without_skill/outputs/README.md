# Space Welcome Banner（without skill baseline）

スペース画面上部に表示する、初めて来たユーザー向けの案内バナーです。

## ファイル構成

| ファイル | 説明 |
|----------|------|
| `SpaceWelcomeBanner.tsx` | メインコンポーネント |
| `SpaceWelcomeBanner.module.css` | グラスモーフィズム + 紫ピンクグラデーションのスタイル |
| `spaceWelcomeBannerStorage.ts` | スペース単位の dismiss 状態（localStorage） |
| `SpaceWelcomeBannerDemo.tsx` | スタンドアロン確認用デモ |
| `index.ts` | エクスポート |

## デザイン

- ピル型（モバイル狭幅では角丸カード）のグラスモーフィズムバナー
- Hossii キャラ（`/hossii/idle/idle_smile.png`）+ きらきら装飾
- 温かい日本語コピー（ようこそ + 投稿を促す案内）
- 「投稿してみる」CTA と × 閉じるボタン
- スライドイン / スライドアウトアニメーション

## SpaceScreen への組み込み例

```tsx
import { SpaceWelcomeBanner } from './SpaceWelcomeBanner';

// SpaceScreen の return 内（VisitBanner の近くなど）
<SpaceWelcomeBanner
  spaceId={activeSpaceId}
  spaceName={space.name}
  withPaneBar={shouldShowSpacePaneBar(/* ... */)}
  characterImageUrl={space.characterImageUrl}
  onPostClick={() => navigateToPost()}
/>
```

## 動作

- 初回訪問時のみ表示（`localStorage` キー: `hossii.spaceWelcomeBanner.dismissed.{spaceId}`）
- 「投稿してみる」または × で非表示になり、同スペースでは再表示しない
- `data-space-export="exclude"` でキャンバス書き出し対象外

## デモ

`SpaceWelcomeBannerDemo` を一時的に `App.tsx` 等で描画すると、暗いスペース背景の上でバナーを確認できます。`respectDismissStorage={false}` のため何度でも「再表示」ボタンで試せます。
