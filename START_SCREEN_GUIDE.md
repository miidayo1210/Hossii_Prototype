# スタート画面とチュートリアルの実装ガイド

Hossiiアプリのスタート画面と初回チュートリアルの実装について説明します。

## 実装内容

### 1. スタート画面 (StartScreen)

未ログイン時に表示される、アプリの最初の画面です。

#### 場所
`src/components/StartScreen/`

#### 特徴
- **宇宙/星空の背景**: アニメーションする星空背景
- **HossiiLive**: 背景で操作不能な状態でゆったり泳ぐHossiiキャラクター（環境演出）
- **アプリロゴ**: 中央に「✨ Hossii」ロゴと説明文を表示
- **はじめるボタン**: クリックでログイン画面をモーダルとして表示

#### 使い方
```typescript
import { StartScreen } from './components/StartScreen/StartScreen';

// 未ログイン時に表示
<StartScreen />
```

### 2. ログイン画面のモーダル化

LoginScreenコンポーネントに `onClose` プロパティを追加し、モーダルとして表示できるようになりました。

#### 変更点
- **オプショナルな onClose プロパティ**: 渡された場合は閉じるボタン（×）を表示
- **閉じるボタン**: カードの右上に配置、半透明の背景

#### 使い方
```typescript
// スタンドアロンとして使用（従来通り）
<LoginScreen />

// モーダルとして使用（新機能）
<LoginScreen onClose={() => setShowLogin(false)} />
```

### 3. 初回チュートリアル (TutorialOverlay)

ログイン後、初めてホーム画面に入った時に表示されるガイドです。

#### 場所
`src/components/Tutorial/`

#### 特徴
- **4ステップのガイド**: Hossiiが話しかけるスタイル
  1. 「やっほー！ここはあなたのスペースだよ ✨」
  2. 「ここから気持ちを置けるよ。\nタップしてみてね！」（投稿ボタンを指差し）
  3. 「ボクをタップすると、\nいろんなことができるよ！」（Hossiiを指差し）
  4. 「それじゃあ、楽しんでね！\nいつでもここにいるからね 💫」

- **画面の暗転**: 背景を暗くして、Hossiiとメッセージを強調
- **ステップインジケーター**: 現在のステップを視覚的に表示
- **ハイライト**: 特定の要素（投稿ボタン、Hossii）を矢印で指示

#### データ保存
- **localStorage に保存**: `hossii_tutorial_seen_{userId}`
- **ユーザーごとに管理**: 各ユーザーIDに紐付けて保存
- **一度完了したら再表示しない**: フラグがある場合はスキップ

#### 使い方
```typescript
import { TutorialOverlay } from './components/Tutorial/TutorialOverlay';

<TutorialOverlay
  userId={userProfile.userId}
  onComplete={() => setShowTutorial(false)}
/>
```

## 画面遷移フロー

```
未ログイン
  ↓
StartScreen（スタート画面）
  ↓ 「はじめる」クリック
LoginScreen（モーダル）
  ↓ ログイン/新規登録
OnboardingModal（プロフィール設定）← 新規登録のみ
  ↓
SpaceScreen（ホーム画面）
  +
TutorialOverlay（チュートリアル）← 初回のみ
```

## ルーティングロジック

`App.tsx` で以下のように制御されています：

```typescript
// 1. 未ログイン時
if (!currentUser) {
  return <StartScreen />;
}

// 2. ログイン済みでプロフィール未設定
if (showOnboarding) {
  return <OnboardingModal onComplete={handleOnboardingComplete} />;
}

// 3. ログイン済みでプロフィール設定済み
return (
  <div>
    {renderScreen()} {/* 通常の画面 */}
    {showTutorial && <TutorialOverlay ... />} {/* 初回のみ */}
  </div>
);
```

## localStorage キー一覧

実装で使用している localStorage のキー：

| キー | 用途 | 値の例 |
|------|------|--------|
| `profile_{uid}` | ユーザープロフィール | `{"userId":"user123","nickname":"太郎"}` |
| `hossii_tutorial_seen_{userId}` | チュートリアル完了フラグ | `"true"` |

## カスタマイズ

### チュートリアルのステップを変更する

`src/components/Tutorial/TutorialOverlay.tsx` の `TUTORIAL_STEPS` 配列を編集：

```typescript
const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 1,
    message: 'カスタムメッセージ',
    highlight: null, // または 'post' / 'hossii'
  },
  // 必要なステップを追加
];
```

### スタート画面のデザインを変更する

`src/components/StartScreen/StartScreen.module.css` を編集：
- `.logo`: ロゴのスタイル
- `.title`: タイトルのスタイル
- `.subtitle`: 説明文のスタイル
- `.startButton`: ボタンのスタイル

### 背景の星をカスタマイズする

LoginScreen と StartScreen は同じ星空アニメーションを使用しています。
速度や密度を変更する場合は、各 CSS ファイルの `@keyframes starsMove` を編集してください。

## トラブルシューティング

### チュートリアルが表示されない

1. localStorage をクリア: 開発者ツールで `localStorage.clear()`
2. ログアウトして再度ログイン
3. チュートリアル完了フラグがリセットされます

### スタート画面でHossiiが表示されない

- HossiiLive コンポーネントが正しくインポートされているか確認
- CSS の `z-index` が適切に設定されているか確認
- ブラウザのコンソールでエラーを確認

### ログイン画面が閉じられない

- StartScreen で `onClose` プロパティが正しく渡されているか確認
- LoginScreen の閉じるボタンのクリックハンドラーが動作しているか確認

## 将来の拡張案

- **スキップ機能**: チュートリアルをスキップできるボタンを追加
- **進捗保存**: チュートリアルの途中で離脱しても、続きから再開できるようにする
- **アニメーション強化**: Hossiiキャラクターの表情やアニメーションを追加
- **多言語対応**: チュートリアルメッセージの多言語化
- **パーソナライズ**: ユーザーの行動に応じてチュートリアルの内容を変更

## ファイル一覧

新規作成されたファイル：
```
src/components/StartScreen/
  ├── StartScreen.tsx
  └── StartScreen.module.css

src/components/Tutorial/
  ├── TutorialOverlay.tsx
  └── TutorialOverlay.module.css
```

変更されたファイル：
```
src/components/Auth/
  ├── LoginScreen.tsx (onClose プロパティ追加)
  └── LoginScreen.module.css (閉じるボタンスタイル追加)

src/App.tsx (ルーティングロジック追加)
```
