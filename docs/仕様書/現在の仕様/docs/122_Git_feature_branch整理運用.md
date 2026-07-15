# 122 Git feature branch 整理運用

> **ステータス:** 運用手順書（**調査日 2026-07-16**・branch 削除は未実施）  
> **参照 main:** `e8a7da8`  
> **対象リポジトリ:** `miidayo1210/Hossii_Prototype`（想定）

## 目的

merge 済み・陳腐化した feature branch を安全に整理し、  
**open PR・未 merge 作業・保護 branch** を誤って消さない運用を定める。

Cursor / エージェントは **branch の削除を自動で行わない**。

---

## 調査スナップショット（2026-07-16）

### main 最新

- `e8a7da8`（PR #17 membership auto-reconcile 等を含む）

### Open PR

| PR | branch | 状態 | メモ |
|----|--------|------|------|
| #9 | `feat/admin-spaces-list-ui` | **OPEN** | 管理者一覧 UI。実装の多くは #10 / #15 で main に入済み。**要: 差分確認後 close または rebase** |

### remote branch 分類

#### merge 済み → 削除候補（main に取り込み済み・独自 commit なし）

`git log main..origin/<branch>` が空のもの:

- `origin/chore/supabase-environment-separation`
- `origin/doc/250417`
- `origin/feat/README`
- `origin/feat/account-community-personal-spaces`
- `origin/feat/admin-personal-space-list`
- `origin/feat/membership-auto-reconcile`
- `origin/feat/personal-space-memberships`
- `origin/feat/space-archive`
- `origin/feat/space-panes`
- `origin/feat/space-tab-ui-batch`
- `origin/feature/devops-and-feature-flags`
- `origin/fix/bubble-shape-reset`
- `origin/fix/personal-space-tab-after-create`
- `origin/fix/post-field-required-labels`
- `origin/fix/production-space-route-and-personal-tab`

#### 未 merge / 要判断 → **削除しない**

| branch | 理由 |
|--------|------|
| `origin/main` | 保護対象 |
| `origin/docs/account-ui-navigation` | main より先行 commit あり（仕様書 `f77bac8` 等） |
| `origin/feat/personal-account` | 個人アカウント・認証 UI の未 merge 作業 |
| `origin/feat/admin-spaces-list-ui` | **Open PR #9** が紐づく |

#### local のみ（remote なしまたは同名）

例: `Hossii-API`, `cursor/9ad50094`, 各種 `feat/*` のローカル checkout

→ remote 削除後に `git fetch --prune` + 下記 local 削除手順で整理。

---

## 削除条件

次を **すべて** 満たすときだけ削除してよい:

1. `main`（または指定の release branch）に **merge 済み**
2. `git log main..<branch>` が **空**（未取り込み commit がない）
3. **Open PR が紐づいていない**（または PR が明示的に close 済みで破棄合意）
4. 他メンバー・Cursor セッションで **進行中でない** と確認済み
5. branch 名が `main` / `release/*` / 保護ルール対象 **ではない**

## 削除しない条件

- Open PR が残っている
- `main..branch` に 1  commit でもある
- 仕様書のみ・調査のみで **意図的に温存** している
- 他人が push した直後で未確認
- production hotfix 用に残す约定がある
- tag が指している commit だけの branch

---

## remote branch 削除

**人間が手動で実行する。** Cursor は実行しない。

```bash
# 1. 未 merge がないか確認
git fetch origin
git log main..origin/feat/example-branch --oneline

# 2. 空なら削除
git push origin --delete feat/example-branch
```

複数まとめて:

```bash
git push origin --delete feat/space-archive fix/bubble-shape-reset
```

---

## local branch 削除

```bash
git checkout main
git pull origin main

# merge 済み local branch の一覧確認
git branch --merged main

# 削除（現在の branch は消せない）
git branch -d feat/example-branch

# merge されていないが捨てる場合（慎重に）
git branch -D feat/example-branch
```

remote 削除後:

```bash
git fetch --prune
```

---

## branch protection

GitHub の **Settings → Branches** で最低限:

| ルール | 推奨 |
|--------|------|
| `main` | PR 必須、force push 禁止、削除禁止 |
| `release/*` | 同様（運用している場合） |

feature branch 自体に protection は通常不要。

---

## tag / release branch

| 種別 | 扱い |
|------|------|
| 軽量 tag `v*` | branch 削除の判断には使わない。tag は残す |
| release branch `release/2026-xx` | **削除しない**（サポート期間中） |
| merge 後に作った tag のみの branch | tag が残っていれば branch は削除可 |

---

## Cursor が勝手に削除しないルール

1. エージェントは `git push origin --delete` / `git branch -D` を **ユーザー明示指示なしに実行しない**
2. 整理手順書（本ドキュメント）の作成・調査だけでは削除しない
3. 「安全そう」と判断しても **一覧提示 → 人間承認 → 実行** の順
4. Open PR 紐づき branch は **close / merge の判断が終わるまで触らない**

---

## 定期整理手順（月 1 回目安）

1. `git fetch --all --prune`
2. `gh pr list --state open` で open PR を確認
3. 各 remote feature branch で `git log main..origin/<branch> --oneline`
4. 削除候補リストを Markdown または issue に貼り、**人間が承認**
5. remote 削除 → `git fetch --prune`
6. `git branch --merged main` で local 整理
7. #9 のような **stale open PR** は差分を見て close または更新

### stale PR #9 の推奨アクション（今回は未実施）

1. `git diff main...origin/feat/admin-spaces-list-ui --stat` で残差分を確認
2. 差分が #15 で代替済みなら PR close + branch 削除候補
3. 有用な差分だけなら cherry-pick 用 branch を切り直し

---

## 今回の推奨アクション（削除はしない）

| 優先 | action |
|------|--------|
| 1 | PR #9 の去就を人間が決定 |
| 2 | merge 済み remote 15 本を一括削除候補として承認待ち |
| 3 | `docs/account-ui-navigation` / `feat/personal-account` は温存 |
| 4 | local `feat/membership-auto-reconcile` 等は `main` 更新後に `-d` |

---

## 関連コマンド早見

```bash
# 全 remote branch と main との差分行数
for b in $(git branch -r | grep -v HEAD | sed 's|origin/||'); do
  n=$(git rev-list --count main..origin/$b 2>/dev/null || echo -)
  echo "$n $b"
done | sort -n

# open PR と head branch
gh pr list --state open --json number,title,headRefName
```
