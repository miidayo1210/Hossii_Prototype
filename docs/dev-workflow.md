# 開発ワークフロー

## 基本方針

**「Vercel Preview での動作確認」が merge の必須条件です。**

コードレビューよりも前に、実際に動くものを Preview URL で確認することを "正" とします。

---

## ブランチ戦略

```
main
  └── feature/xxx   ← 機能追加
  └── fix/xxx       ← バグ修正
  └── hotfix/xxx    ← 本番障害の緊急修正
  └── chore/xxx     ← リファクタリング・設定変更など
```

### 命名規則

| 種別 | 例 |
|------|-----|
| 機能追加 | `feature/add-thumbnail-flag` |
| バグ修正 | `fix/comment-screen-crash` |
| 緊急修正 | `hotfix/supabase-connection-error` |
| その他 | `chore/update-dependencies` |

---

## 通常の開発フロー

```
1. main から ブランチを切る
   git switch -c feature/your-feature main

2. 開発・コミット
   git add . && git commit -m "feat: ..."

3. GitHub に push
   git push -u origin feature/your-feature

4. Pull Request を作成（PRテンプレに沿って記載）
   - 目的・変更点・影響範囲を書く
   - Vercel が自動で Preview をデプロイする

5. Vercel Preview URL で動作確認
   - 投稿・閲覧などの主要フローを通しで確認
   - PRテンプレの「主要確認項目」チェックリストを埋める
   - Preview URL を PR 本文に貼る（必須）

6. CI（GitHub Actions）がグリーンになるのを確認

7. main へ merge
```

### merge の必須条件

- [ ] CI（lint + build）がグリーン
- [ ] Vercel Preview URL が PR 本文に貼られている
- [ ] Preview で主要フローの動作確認済み
- [ ] DB変更がある場合はmigrationファイルが含まれている

---

## hotfix フロー（本番障害の緊急修正）

本番（main）で重大なバグが発生した場合:

```
1. main から hotfix ブランチを切る（直接 main に push しない）
   git switch -c hotfix/critical-bug-description main

2. 最小限の修正のみコミット

3. PR を作成し、Vercel Preview で修正確認

4. CI グリーン確認後、main へ merge（必要なら即 merge）

5. merge 後、Vercel が自動デプロイ → 本番反映を確認
```

> **hotfix でも main への直接 push は禁止です。**
> 緊急時ほどミスが起きやすいため、Preview で確認してから merge してください。

---

## Vercel Preview の使い方

- PR を作成すると Vercel が自動的に Preview 環境をビルド・デプロイします
- Preview URL は PR の Checks タブか、Vercel の GitHub コメントから確認できます
- Preview URL を PR 本文の「Preview URL」欄に貼ってください（確認した証跡にもなります）
- Preview 環境は Supabase の本番DB に接続します（`VITE_SUPABASE_URL` が同じため）

### Preview でのテスト手順

1. Preview URL にアクセス
2. スペースを開く / 投稿する / コメント一覧を確認する（主要フロー）
3. 変更した機能が意図通り動くか確認
4. スマートフォン or Chrome DevTools のモバイルビューでも確認

---

## コミットメッセージ規約

```
<type>: <内容>

type:
  feat     - 機能追加
  fix      - バグ修正
  chore    - ビルド・設定・依存関係
  docs     - ドキュメント
  refactor - リファクタリング
  style    - フォーマット・スタイル
  test     - テスト
```

例:
```
feat: コメント一覧サムネイルのFeature Flagを追加
fix: Supabase接続エラー時のフォールバック処理を修正
docs: dev-workflow.md を追加
```

---

## main への直接 push は禁止

GitHub の Branch Protection Rules で main への直接 push を禁止しています。
設定手順は [docs/github-branch-protection.md](./github-branch-protection.md) を参照してください。
