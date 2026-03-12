# Hossii モーション・表情仕様

> **分類:** `[UI/UX]` Hossii キャラクター・アニメーション・表情表現
> **関連:** `31_いいねボタンUI.md` / `13_スペースUIUX.md`
> 最終更新: 2026-03-10
> 関連ファイル:
> `src/components/Hossii/HossiiLive.tsx`（Hossii キャラクター本体）
> `src/components/SpaceScreen/SpaceScreen.tsx`（Hossii の配置・トリガー）

---

## 概要

スペース画面に表示される Hossii キャラクターを「生き生きと活動している」ように見せる。表情変化・吹き出しセリフ・Z 軸回転などのモーションを追加し、投稿状況に応じてリアクションする仕組みを設計する。

| # | 要件 | ゴール |
|---|---|---|
| F | 表情をもっと豊かにしたい | 日常的にニコッとするなど、多様な表情変化を見せる |
| S | セリフを吹き出しで喋らせたい | ランダムにたまに吹き出しセリフが表示される |
| R | Z 軸回転などの動きをつけたい | Hossii が軸回転・揺れなど生き物らしく動く |
| J | 投稿が増えると嬉しそうにしたい | 投稿数に応じて喜び度が上がる |

---

## F: 表情バリエーション

### 設計方針

- 現在の `reactionFace` の仕組みを拡張し、「アイドル表情」として定期的にランダムな表情を切り替える。
- 表情は大きく **アイドル系**（待機中）と **リアクション系**（イベント時）に分類する。
- リアクション系が発火中はアイドル系への切り替えを抑制する。

### F01: 表情カテゴリ定義

| カテゴリ | 表情キー候補 | 発火タイミング |
|---|---|---|
| アイドル系 | `idle`, `smile`, `wink`, `think` | 一定間隔でランダム切り替え |
| 喜び系 | `joy`, `fun`, `laugh` | いいね・投稿受信時 |
| 驚き系 | `surprise` | 新規投稿が増えたとき |
| 眠い系 | `sleepy`, `yawn` | 一定時間操作がないとき（オプション） |

### F02: アイドルモーション間隔

- アイドル表情の切り替え間隔: `8〜15 秒`（ランダム）
- 各表情の表示時間: `1.5〜3 秒`（ランダム）
- 表示後は `idle`（デフォルト表情）に戻る

### F03: 実装箇所

`HossiiLive.tsx` に `useEffect` でタイマーを設定し、アイドル表情をランダムに切り替える。

```tsx
useEffect(() => {
  const scheduleIdleEmotion = () => {
    const delay = 8000 + Math.random() * 7000; // 8〜15秒
    return setTimeout(() => {
      if (reactionFace) return; // リアクション中はスキップ
      const idleFaces: EmotionKey[] = ['smile', 'wink', 'think'];
      const face = idleFaces[Math.floor(Math.random() * idleFaces.length)];
      setReactionFace(getHossiiFace(face));
      setTimeout(() => setReactionFace(null), 1500 + Math.random() * 1500);
      timerId = scheduleIdleEmotion(); // 再スケジュール
    }, delay);
  };
  let timerId = scheduleIdleEmotion();
  return () => clearTimeout(timerId);
}, []);
```

---

## S: セリフ吹き出し

### 設計方針

- Hossii の頭上に吹き出しを表示し、ランダムなセリフを喋らせる。
- セリフはスペース状況（時間帯・投稿数）に応じてセットを切り替える。
- 吹き出しは `position: absolute` で Hossii キャラクターの上部に配置し、フェードイン・アウトで表示する。

### S01: セリフ一覧（初期セット）

| カテゴリ | セリフ例 |
|---|---|
| 挨拶 | 「元気〜？」「おはよ！」「こんにちは！」「やあ！」 |
| 投稿促進 | 「なにか感じてる？」「気持ちを教えてね」「今どんな気分？」 |
| 反応 | 「いいね！」「それ、わかる〜」「ありがとう！」 |
| 投稿が少ないとき | 「静かだね〜」「だれかいる？」 |
| 投稿が多いとき | 「にぎやかだね！」「みんな元気そう！」「うれしいな〜」 |

### S02: 吹き出し表示仕様

```
         ┌──────────────┐
         │ 元気〜？      │  ← フェードイン / フェードアウト
         └─────┬────────┘
               ↓
         [ Hossii キャラ ]
```

- 表示時間: `3〜5 秒`
- トランジション: `opacity 0.4s ease`
- 表示間隔: `12〜20 秒`（ランダム）
- セリフ選択: 現在の投稿数をもとにカテゴリを選択し、そのカテゴリ内でランダム選択

### S03: 投稿数によるカテゴリ選択

| 投稿数 | 優先カテゴリ |
|---|---|
| 0 件 | 挨拶・投稿促進 |
| 1〜5 件 | 挨拶・反応 |
| 6 件以上 | 反応・「投稿が多いとき」 |

### S04: CSS（`SpaceScreen.module.css` または `HossiiLive.module.css`）

```css
.hossiiSpeechBubble {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: #fff;
  border: 1.5px solid rgba(0, 0, 0, 0.12);
  border-radius: 12px;
  padding: 6px 12px;
  font-size: 12px;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  pointer-events: none;
  animation: speechFadeIn 0.4s ease forwards;
}

@keyframes speechFadeIn {
  from { opacity: 0; transform: translateX(-50%) translateY(4px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}
```

---

## R: モーション（Z 軸回転・揺れ）

### 設計方針

- Hossii が常時わずかに揺れ・呼吸しているような **アイドルアニメーション** を追加する。
- 特定のイベント（投稿受信・いいね）で **Z 軸回転（くるっと回る）** などのリアクションモーションを出す。
- パフォーマンスを考慮し、`transform` のみ使用（`top/left` は変えない）。

### R01: アイドル揺れアニメーション

```css
@keyframes hossiiIdle {
  0%, 100% { transform: rotate(-2deg) scale(1); }
  25%       { transform: rotate(2deg) scale(1.02); }
  50%       { transform: rotate(-1deg) scale(1); }
  75%       { transform: rotate(1.5deg) scale(1.01); }
}

.hossiiCharacter {
  animation: hossiiIdle 4s ease-in-out infinite;
}
```

### R02: Z 軸回転（スピン）モーション

いいね・新規投稿受信などのイベント時に一回転させる。

```css
@keyframes hossiiSpin {
  0%   { transform: rotateZ(0deg) scale(1); }
  40%  { transform: rotateZ(200deg) scale(1.12); }
  70%  { transform: rotateZ(340deg) scale(1.05); }
  100% { transform: rotateZ(360deg) scale(1); }
}

.hossiiSpinning {
  animation: hossiiSpin 0.6s cubic-bezier(0.36, 0.07, 0.19, 0.97) forwards;
}
```

### R03: React 実装

```tsx
const [isSpinning, setIsSpinning] = useState(false);

const triggerSpin = () => {
  if (isSpinning) return;
  setIsSpinning(true);
  setTimeout(() => setIsSpinning(false), 600);
};

<div
  className={[
    styles.hossiiCharacter,
    isSpinning ? styles.hossiiSpinning : '',
  ].filter(Boolean).join(' ')}
>
  {/* Hossii 本体 */}
</div>
```

---

## J: 投稿数に応じた喜び表現

### 設計方針

- 投稿数が増えるほど Hossii の「元気度」が上がる。
- 段階的に表情・モーション頻度・アイドルアニメーション速度が変化する。

### J01: 元気度レベル定義

| レベル | 投稿数 | 状態 | 変化内容 |
|---|---|---|---|
| Lv0 | 0 件 | 静か | アイドルアニメーション: 遅め（6s cycle）|
| Lv1 | 1〜3 件 | 普通 | アイドルアニメーション: 標準（4s cycle）|
| Lv2 | 4〜9 件 | 元気 | アイドルアニメーション: やや速め（3s cycle）+ スピン頻度アップ |
| Lv3 | 10 件以上 | 大はしゃぎ | アイドルアニメーション: 速め（2s cycle）+ 表情変化頻度アップ |

### J02: 新規投稿受信時のリアクション

- 新しい Hossii 投稿が追加されるたびに喜び系表情（`joy` / `fun` / `laugh`）をセット。
- スピンモーション（R02）を発火。
- セリフ吹き出しで「にぎやかだね！」などの反応セリフを優先表示。

---

## 実装優先順位

| フェーズ | 内容 | 影響ファイル |
|---|---|---|
| Phase 1 | **R01**: アイドル揺れ CSS | `HossiiLive.tsx` + CSS |
| Phase 2 | **F02/F03**: アイドル表情ランダム切り替え | `HossiiLive.tsx` |
| Phase 3 | **S**: セリフ吹き出し | `HossiiLive.tsx` + CSS |
| Phase 4 | **R02/R03**: Z 軸スピンモーション | `HossiiLive.tsx` + CSS |
| Phase 5 | **J**: 投稿数連動・元気度レベル | `HossiiLive.tsx` + `SpaceScreen.tsx` |

---

## 未決事項

- セリフのテキストは日本語固定か、スペース設定で言語切替が必要か。
- 吹き出しの見た目（フォント・形）を `29_吹き出しの形.md` のデザインに合わせるか確認。
- `hossiiIdle` アニメーションと `hossiiSpinning` の競合をどう制御するか（`animationPlayState` で pause するか、クラスの切り替えで対応するか）。
- 「踊る」表現（上下ジャンプ・左右ステップ）をモーションとして追加するか検討。
