---
name: hossii-design
description: >
  Hossii固有のデザイン言語でUI/UXを設計・実装するスキル。Hossiiプロジェクトで新しいコンポーネント、画面、アニメーション、スタイルを作るときに必ず使う。「Hossiiらしいデザインにして」「このUIをHossiiっぽく」「新しいコンポーネントを作って」「アニメーションを追加して」「スペース画面」「投稿フォーム」「グラスモーフィズム」「ぷにぷに」など、HossiiプロジェクトのUI/UXに関する作業はすべてこのスキルを使う。フロントエンドの実装だけでなく、デザイン判断・コピー案・アニメーション設計にも活用する。
---

このスキルはHossii Prototypeプロジェクト専用のUI/UXガイドです。  
**実装前に必ずこのスキルを読み、Hossiiのデザイン言語に沿って判断してください。**

---

## Hossiiとは何か

Hossiiは「小さな気持ちが積み重なって、スペースに景色をつくる」プラットフォーム。  
投稿は"Post"ではなく**Hossii（気持ち）**。アクションは「送信」ではなく**「気持ちを置く」**。

UIの役割は**感情を安全に置ける場所をつくること**。ツールを操作させるのではなく、感情を宇宙に浮かべる体験を届ける。

---

## 二つのUI文脈

Hossiiには明確に異なる2つのUIがある。どちらのコンテキストか判断してから実装に入る。

| | コンシューマー（体験） | 管理画面（設定） |
|---|---|---|
| **感覚** | 魔法・宇宙・温かい感情 | クリーンなSaaS |
| **背景** | ピンク→ラベンダー→ブルーのグラデーション | `#f5f6fa` グレー |
| **カード** | フロストガラス（半透明白 + blur） | 白カード、明確なボーダー |
| **主色** | 紫ピンクグラデーション | インジゴ `#4f46e5` |
| **コピー** | 「気持ちを置く」感情的な言葉 | 設定・保存・適用 |
| **アニメーション** | ぷにぷに・ふわふわ・きらきら | 控えめなtransition |

---

## カラーパレット

```css
/* ブランドグラデーション（ボタン・アクティブ状態・バッジ） */
background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%);

/* パープル（階調） */
#a855f7  /* primary / アイコンアクティブ */
#7c3aed  /* 3Dボタンシャドウ / 強調 */
#6d28d9  /* hover・深み */
#e9d5ff  /* ラベンダー面 */
#faf5ff  /* 極薄ラベンダー背景 */
#f3e8ff  /* ホバー時の薄い塗り */

/* ピンク */
#ec4899  /* グラデーション終点 / ハイライト */
#fbcfe8  /* 薄いピンク面 */

/* テキスト・ニュートラル */
#6b7280  /* muted text */
#4b5563  /* secondary text */
#111827  /* ほぼ黒 */
#9ca3af  /* placeholder */

/* 管理画面専用 */
#4f46e5  /* admin primary */
#f5f6fa  /* admin 背景 */
```

感情カラー（8種）は `src/core/assets/emotionColors.ts` を参照。  
吹き出しカラーパレット（4テーマ×8色）は `src/core/utils/bubbleColorPalettes.ts` を参照。

---

## グラスモーフィズム（コンシューマー文脈）

フロストガラスはHossiiの基本構造。背景グラデーション上に浮かぶ全てのパネル・カードに適用する。

```css
/* 標準グラスカード */
background: rgba(255, 255, 255, 0.85);
backdrop-filter: blur(12px);
-webkit-backdrop-filter: blur(12px);
border: 1px solid rgba(255, 255, 255, 0.6);
border-radius: 1rem;
box-shadow: 0 4px 24px rgba(168, 85, 247, 0.08);

/* 濃いめ（モーダル・フローティングパネル） */
background: rgba(255, 255, 255, 0.92);
backdrop-filter: blur(16px);

/* 暗い文脈（auth・ダーク宇宙背景） */
background: rgba(255, 255, 255, 0.08);
backdrop-filter: blur(16px);
border: 1px solid rgba(255, 255, 255, 0.15);
```

---

## ボタン・インタラクション形状

```css
/* ピル形状（ナビ・タグ・チップ全般） */
border-radius: 9999px;

/* メインCTA（3D押し込み感） */
.sendButton {
  background: linear-gradient(135deg, #a855f7, #ec4899);
  border-radius: 9999px;
  box-shadow: 0 5px 0 #7c3aed;
  transition: transform 0.1s, box-shadow 0.1s;
}
.sendButton:active {
  transform: translateY(3px);
  box-shadow: 0 2px 0 #7c3aed;
}

/* グラデーションテキスト（見出し・スペース名） */
.gradientText {
  background: linear-gradient(135deg, #a855f7, #ec4899);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

---

## アニメーション

グローバルアニメーションクラスは `src/core/ui/motion.css` に定義済み。  
新しいコンポーネントではここのクラスを**再利用する**。追加が必要なときもこのファイルに追記し、`hossii-` プレフィックスを使う。

| クラス | 用途 | 特性 |
|--------|------|------|
| `hossii-pop` | タップ・追加時のリアクション | 180ms scale スナッピー |
| `hossii-soft-bounce` | 出現・確認アクション | スプリング感 |
| `hossii-float-slow` | 常時浮遊（マスコット・バブル） | 無限・穏やか |
| `hossii-sparkle` | 成功・喜び演出 | きらきら |
| `hossii-bg-glow` | 背景アンビエント | ゆったり無限 |

**ルール：**
- `transform` と `opacity` のみアニメーション（パフォーマンス）
- 必ず `prefers-reduced-motion: reduce` 対応を入れる
- 「きらきら」「ふわふわ」「ぷにぷに」の感触を言葉で考えてからアニメーション値を選ぶ
- 派手にしすぎない。1インタラクション＝1アニメーション

---

## CSSアーキテクチャ

- **CSS Modules** のみ（`ComponentName.module.css` をコンポーネントと同じディレクトリに配置）
- グローバルスタイルは `src/index.css`（body font, reset）と `src/core/ui/motion.css`（アニメーション）のみ
- 色は現状ハードコード（CSS変数システムなし）。パレットの値を上記から引用する
- 共有スタイルが必要なら `src/core/ui/` 以下に追加

---

## タイポグラフィ

- フォント: システムUIスタック（`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto…`）を踏襲
- 日本語ファーストのUI。感情的・やわらかい言葉を選ぶ
- サイズスケール: `0.75rem`（ラベル）→ `0.875rem`（本文）→ `1rem`（標準）→ `1.25rem`（見出し）→ `1.5rem`（タイトル）
- 重みは 500〜700。細すぎるフォントは使わない

---

## Hossiiコピー規則

コンポーネントに文言が必要なとき：

| 避ける（一般的すぎる） | Hossiiらしい言葉 |
|---|---|
| 投稿する | 気持ちを置く |
| 送信 | 置く |
| コメント | Hossii / 気持ち |
| ログアウト | おわる |
| エラーが発生しました | うまくいかなかった… |
| 読み込み中 | 気持ちをひろっています |

マスコット（HossiiLive）が話す場合は必ずカジュアルで温かく：  
「元気〜？」「なにか感じてる？」「にぎやかだね！」

---

## よくある実装判断

**新しいモーダル・ダイアログを作る場合**  
→ `useModalPortalRoot` を使って `document.body` にポータルマウント。フロストガラス + `hossii-soft-bounce` で出現。

**ナビゲーションのアクティブ状態**  
→ ピル形状 + `linear-gradient(135deg, #a855f7, #ec4899)` で塗りつぶし。非アクティブはグレー。

**吹き出し（Hossiiバブル）を追加する場合**  
→ `bubbleColorPalettes.ts` のカラーを使い、`rgba(color, 0.80)` で半透明表示。

**ローディング状態**  
→ `hossii-float-slow` + 紫系のスケルトン。スピナーは極力使わない。

**エラー状態**  
→ `#ef4444` は使うが、「エラー」より「うまくいかなかった」という言葉でラップ。

---

## 実装チェックリスト

コンポーネントを作り終えたら確認：

- [ ] コンシューマー/管理画面のどちらの文脈か明示できるか
- [ ] カラーはパレットの値を使っているか（新しい色を勝手に増やしていないか）
- [ ] フロストガラスの透明度・blur値は標準値か
- [ ] ピル形状（`border-radius: 9999px`）を適切に使っているか
- [ ] アニメーションは `hossii-*` クラスを再利用しているか
- [ ] `prefers-reduced-motion` 対応はあるか
- [ ] コピーはHossiiの言葉か（一般的なWebアプリ表現になっていないか）
- [ ] CSSは `.module.css` として分離されているか
