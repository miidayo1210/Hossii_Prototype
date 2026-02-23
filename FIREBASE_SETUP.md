# Firebase Authentication Setup Guide

Hossiiアプリで認証機能を使用するためのセットアップ手順です。

## 1. Firebase プロジェクトの作成

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. 「プロジェクトを追加」をクリック
3. プロジェクト名を入力（例: hossii-demo）
4. Google Analytics の設定（オプション）
5. プロジェクトを作成

## 2. Firebase Authentication の有効化

1. Firebase Console で作成したプロジェクトを開く
2. 左メニューから「Authentication」を選択
3. 「始める」をクリック
4. ログイン方法を有効化：
   - **メール/パスワード**: 有効にする
   - **Google**: 有効にする（プロジェクトのサポートメールを設定）
   - **Facebook**: 有効にする（Facebook アプリIDとシークレットが必要）

### Facebook ログインの追加設定

1. [Facebook Developers](https://developers.facebook.com/) でアプリを作成
2. Facebook Login を追加
3. アプリIDとアプリシークレットを取得
4. Firebase Console の Facebook ログイン設定に入力
5. Firebase が提供する OAuth リダイレクト URI を Facebook アプリの設定に追加

## 3. Web アプリの登録

1. Firebase Console のプロジェクト設定（歯車アイコン）を開く
2. 「アプリを追加」から「ウェブ」を選択
3. アプリのニックネームを入力（例: Hossii Web）
4. Firebase Hosting の設定（オプション）
5. 「アプリを登録」をクリック

## 4. 環境変数の設定

1. プロジェクトのルートディレクトリに `.env` ファイルを作成
2. `.env.example` の内容をコピー
3. Firebase Console から取得した設定値を入力：

```bash
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 設定値の取得方法

Firebase Console のプロジェクト設定から：
- 「全般」タブを開く
- 「マイアプリ」セクションで登録したウェブアプリを選択
- 「SDK の設定と構成」で「構成」を選択
- `firebaseConfig` オブジェクトから各値をコピー

## 5. アプリの起動

```bash
# 依存関係のインストール（既に完了している場合はスキップ）
npm install

# 開発サーバーの起動
npm run dev
```

## 6. 認証フローのテスト

1. ブラウザで `http://localhost:5173` を開く
2. ログイン画面が表示されることを確認
3. 新規登録をテスト：
   - 「新規登録」タブを選択
   - メールアドレスとパスワード（6文字以上）を入力
   - または Google/Facebook ログインボタンをクリック
4. プロフィール設定画面が表示されることを確認：
   - ユーザーID（英数字3-20文字）を入力
   - ニックネームを入力
   - 「完了」をクリック
5. ホーム画面（SpaceScreen）が表示されることを確認

## セキュリティ上の注意

- `.env` ファイルは `.gitignore` に追加されており、Git にコミットされません
- 本番環境では環境変数を適切に管理してください
- API キーは公開されても問題ありませんが、Firebase Console でドメイン制限を設定することを推奨

## トラブルシューティング

### ログインボタンをクリックしても反応しない

- ブラウザのコンソールでエラーを確認
- Firebase Console で認証方法が有効になっているか確認
- `.env` ファイルの設定が正しいか確認

### Google ログインでエラーが発生する

- Firebase Console で Google ログインが有効になっているか確認
- プロジェクトのサポートメールが設定されているか確認
- ブラウザでポップアップがブロックされていないか確認

### Facebook ログインでエラーが発生する

- Facebook アプリが本番モードになっているか確認
- OAuth リダイレクト URI が正しく設定されているか確認
- Facebook アプリ ID とシークレットが正しく入力されているか確認

## 次のステップ

現在の実装では、プロフィール情報は `localStorage` に保存されています。
本番環境では Firestore を使用してユーザープロフィールを管理することを推奨します。

実装予定の機能：
- Firestore へのユーザープロフィール保存
- ユーザーID の重複チェック
- パスワードリセット機能
- メール確認機能
