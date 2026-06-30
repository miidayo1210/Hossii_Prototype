# NewHossiiToast（without_skill baseline）

新しい Hossii が届いたときに表示するトースト通知コンポーネントです。

## Files

| File | Purpose |
|------|---------|
| `NewHossiiToast.tsx` | メインコンポーネント |
| `NewHossiiToast.module.css` | グラスモーフィズム + ブランドグラデーション + アニメーション |
| `types.ts` | 最小 Hossii 型とプレビュー整形 |
| `useNewHossiiToast.ts` | 連続到着用キューフック |
| `Demo.tsx` | スタンドアロン動作確認 UI |
| `index.ts` | エクスポート |
| `css-modules.d.ts` | CSS Modules 型宣言 |

## Usage

```tsx
import { NewHossiiToast } from './NewHossiiToast';

<NewHossiiToast
  hossii={{ id: '1', authorName: 'みう', emotion: 'joy', message: '今日はいい日' }}
  show={show}
  onClose={() => setShow(false)}
  onView={(h) => scrollToHossii(h.id)}
/>
```

キュー利用:

```tsx
const { toast, notify, close } = useNewHossiiToast();

notify({ id: '2', authorName: 'はる', message: '届いたよ' });

{toast && (
  <NewHossiiToast hossii={toast.hossii} show={toast.show} onClose={close} />
)}
```

## Design notes

- フロストガラス（`backdrop-filter: blur` + 半透明白）
- 紫→ピンクのブランドグラデーション（`#a855f7` → `#ec4899`）
- 「新しい Hossii が届きました」「〜の気持ち」など Hossii 用語
- ふわっとした `hossiiToastPop` 出現アニメーション
- `prefers-reduced-motion: reduce` でアニメーション抑制

## Demo

`Demo.tsx` の `NewHossiiToastDemo` を任意の React アプリにマウントして確認できます。
