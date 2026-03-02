# GitHub Branch Protection 設定手順

main ブランチへの直接 push を禁止し、PR 経由でのみ merge できるようにします。

---

## 設定手順

### 1. Branch Protection Rule を開く

1. GitHub のリポジトリページを開く
2. **Settings** タブをクリック
3. 左メニューの **Code and automation** → **Branches** をクリック
4. **Branch protection rules** セクションの **Add rule** をクリック

### 2. Branch name pattern を設定

```
main
```

### 3. 以下の項目を設定する

#### 必須設定

| 項目 | 設定値 | 理由 |
|------|--------|------|
| **Require a pull request before merging** | ✅ ON | main への直接 push を禁止 |
| ↳ Required number of approvals | 0（現時点） | 1人開発のため。チームになったら 1 以上に変更 |
| **Require status checks to pass before merging** | ✅ ON | CI（lint/build）がグリーンでないと merge できない |
| ↳ Status checks that are required | `lint-and-build` | `.github/workflows/ci.yml` の job 名 |
| ↳ Require branches to be up to date before merging | ✅ ON | 古いブランチのままの merge を防ぐ |
| **Do not allow bypassing the above settings** | ✅ ON | 管理者も例外なくルールを適用 |

#### 推奨設定（チームになったら有効化）

| 項目 | 推奨値 | タイミング |
|------|--------|----------|
| Required number of approvals | 1 以上 | チームメンバーが増えたとき |
| Require conversation resolution before merging | ✅ ON | レビューコメントが全て解決されるまで merge 不可 |
| Require signed commits | ✅ ON | セキュリティを高めたいとき |

### 4. Save changes をクリック

---

## 設定後の動作確認

設定後、以下のコマンドで main への直接 push が拒否されることを確認してください。

```bash
# main に直接 push しようとするとエラーになる（はず）
git switch main
echo "test" >> README.md
git add . && git commit -m "test"
git push origin main
# → remote: error: GH006: Protected branch update failed for refs/heads/main.
```

---

## CI の status check 名について

このリポジトリでは `.github/workflows/ci.yml` に以下の job が定義されています：

```
job: lint-and-build
```

**Require status checks** の検索欄に `lint-and-build` と入力して選択してください。

> **注意:** CI が一度も実行されていない状態では status check が選択肢に出ません。
> 先に feature ブランチで PR を作成して CI を1回実行してから設定してください。

---

## トラブルシューティング

### 管理者でも push できない場合

「Do not allow bypassing the above settings」が ON になっています。
緊急時は一時的に設定を変更するか、hotfix ブランチを作って PR 経由で対応してください。

### CI が通らず merge できない場合

1. Actions タブでエラーログを確認
2. ローカルで `npm run lint` と `npm run build` を実行して再現
3. 修正後に push → CI を再実行
