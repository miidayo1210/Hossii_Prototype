## Hossii Prototype

Hossii Prototype は、日々の気持ちや出来事（Hossii）を星空のようなスペースに記録・可視化するためのデモ用フロントエンドアプリケーションです。  
ログイン、オンボーディング、投稿画面、スペース切り替え、コメントやマイログ表示など、感情ログサービスの体験フローを検証することを目的としています。

※このリポジトリは **デモ / プロトタイプ** 用であり、バックエンド連携は行わず、主にローカルストレージやモックデータを利用します。

### 主な機能

- **Hossii 投稿**
  - テキストベースで気持ちや出来事（Hossii）を投稿
  - クイック感情ボタン（`DEFAULT_QUICK_EMOTIONS`）による簡単入力
- **スペース（Space）機能**
  - 複数のスペースを切り替えて感情ログを管理
  - 招待リンク（`?space=xxx`）から共有スペースに参加
  - スペースごとのニックネーム設定
- **ビジュアル表現**
  - 星空やツリーなどの背景表現（`SpaceScreen`, `StarView` など）
  - Hossii キャラクターの表情・アニメーション
- **ログ・コメント表示**
  - 自分のログ一覧（`MyLogsScreen`）
  - コメント表示・閲覧（`CommentsScreen`）
- **アカウント / プロフィール**
  - ログイン状態に応じた Start 画面表示（`StartScreen`）
  - プロフィール編集（`ProfileScreen`）
  - アカウント設定画面（`AccountScreen`）
- **その他 UI**
  - スペース設定（背景・Hossii 表示など）の編集（`SpaceSettingsScreen`）
  - スタンプカード画面（`StampCardScreen`）
  - チュートリアルオーバーレイ、オンボーディングモーダル、ニックネームモーダル など

### 技術スタック

- **フロントエンド**: React 19 + TypeScript
- **バンドラ / 開発サーバ**: Vite
- **状態管理**: React Context + `useReducer`（`useHossiiStore`）
- **ルーティング**: 独自フック `useRouter`（ハッシュベース）
- **UI / アイコン**: CSS Modules, `lucide-react`
- **その他ライブラリ**
  - `react-qr-code`（スペース共有用 QR コード表示）
  - `react-router-dom`（将来的なルーティング拡張用）

Firebase SDK は依存として含まれていますが、`src/core/firebase.ts` ではモック実装となっており、実際の Firebase 初期化は行っていません（認証・プロフィールなどはローカルストレージで疑似的に扱います）。

### セットアップ

1. **リポジトリをクローン**

   ```bash
   git clone <このリポジトリのURL>
   cd Hossii_Prototype
   ```

2. **依存関係をインストール**

   ```bash
   npm install
   ```

3. **開発サーバを起動**

   ```bash
   npm run dev
   ```

4. ブラウザで表示  
   Vite の起動ログに表示される URL（通常は `http://localhost:5173` など）にアクセスします。

### 開発コマンド

`package.json` に定義されている主なスクリプトは以下の通りです。

```bash
npm run dev      # 開発サーバ起動
npm run build    # 本番ビルド（tsc + vite build）
npm run lint     # ESLint による静的解析
npm run preview  # 本番ビルドのプレビュー
```

### ディレクトリ構成（抜粋）

```bash
src/
  main.tsx              # エントリポイント
  App.tsx               # ルートコンポーネント
  App.module.css        # アプリ全体のスタイル

  core/
    hooks/
      useHossiiStore.tsx    # グローバル状態管理（Context + useReducer）
      useRouter.ts          # ハッシュベースのルーティング
      useMediaQuery.ts      # メディアクエリ判定
      useSpeechRecognition.ts, useAudioListener.ts  # 音声関連のフック
    contexts/
      AuthContext.tsx       # 認証状態（モック）とユーザー情報
    types/
      index.ts, space.ts, profile.ts, mode.ts, stamp.ts, settings.ts  # ドメイン型定義
    utils/
      storage 関連（各種 *_storage.ts）
      emotionKeywords.ts, languageDetection.ts など
    ui/
      HossiiBackground.tsx, HossiiToast.tsx などの共通 UI
    assets/
      hossiiFaces.ts, hossiiIdle.ts, emotions.ts など

  components/
    PostScreen/
    SpaceScreen/
    StarsScreen/
    SpacesScreen/
    ProfileScreen/
    MyLogsScreen/
    CommentsScreen/
    AccountScreen/
    SpaceSettingsScreen/
    StampCardScreen/
    Navigation/       # TopBar / BottomNavBar など
    Hossii/           # Hossii 表示コンポーネント
    Tutorial/
    Auth/
    ...

  demo/
    mockData.ts       # デモ用の Hossii モックデータ
```

### アーキテクチャのポイント

- **コアロジックと UI の分離**
  - `src/core/` に型定義・状態管理・ユーティリティを配置し、`src/components/` 側から利用する構成です。
  - 将来的にグローバルストア（例: Zustand）へ移行しやすい形で `useHossiiStore` が実装されています。
- **ルーティング**
  - `useRouter` によりハッシュベース（`#post`, `#screen` など）で画面遷移を管理します。
  - モバイルアプリのような単一ページ内での画面切り替え体験を重視しています。
- **データ永続化**
  - さまざまな設定・状態（フィルタ、プロフィール、スペース設定など）はローカルストレージラッパー（`storage.ts` / `*_storage.ts`）を経由して保存されます。
  - バックエンドや実データベースには接続していません。

### 注意事項

- このリポジトリは **プロトタイプ / デモ用途専用** です。  
  実サービスとしてのセキュリティ・スケーラビリティ・アクセシビリティ等は十分に考慮されていません。
- Firebase 連携は無効化されており、本番環境での利用を前提としていません。
- 仕様は今後大きく変更される可能性があります。

プロジェクト構造やコードに関する質問・変更の相談があれば、遠慮なく聞いてください。