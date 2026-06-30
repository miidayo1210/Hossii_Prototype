import { useState, type CSSProperties } from 'react';
import { NewHossiiToast } from './NewHossiiToast';
import { useNewHossiiToast } from './useNewHossiiToast';
import type { NewHossiiPayload } from './types';

const SAMPLE_HOSSIIS: NewHossiiPayload[] = [
  {
    id: '1',
    authorName: 'みう',
    emotion: 'joy',
    message: '今日の空、すごくきれいだった',
  },
  {
    id: '2',
    authorName: 'はる',
    emotion: 'wow',
    message: 'このスペース、初めて来たけど温かい',
  },
  {
    id: '3',
    authorName: 'そら',
    emotion: 'fun',
    message: '',
  },
];

const demoPageStyle: CSSProperties = {
  minHeight: '100vh',
  padding: '2rem',
  fontFamily: '"Hiragino Sans", "Noto Sans JP", sans-serif',
  background:
    'linear-gradient(160deg, #fdf4ff 0%, #fce7f3 45%, #ede9fe 100%)',
};

const panelStyle: CSSProperties = {
  maxWidth: '28rem',
  margin: '0 auto',
  padding: '1.5rem',
  borderRadius: '1.25rem',
  background: 'rgba(255,255,255,0.7)',
  boxShadow: '0 8px 24px rgba(168, 85, 247, 0.12)',
};

const buttonStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: '0.75rem',
  padding: '0.75rem 1rem',
  border: 'none',
  borderRadius: '9999px',
  background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
};

/** スタンドアロン確認用デモ（outputs 配下） */
export function NewHossiiToastDemo() {
  const [single, setSingle] = useState<NewHossiiPayload | null>(null);
  const [singleShow, setSingleShow] = useState(false);
  const { toast, notify, close } = useNewHossiiToast();

  const showSingle = (hossii: NewHossiiPayload) => {
    setSingle(hossii);
    setSingleShow(true);
  };

  return (
    <div style={demoPageStyle}>
      <div style={panelStyle}>
        <h1 style={{ margin: 0, fontSize: '1.125rem', color: '#5b21b6' }}>
          NewHossiiToast Demo
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
          新しい Hossii 到着トーストの動作確認
        </p>

        {SAMPLE_HOSSIIS.map((hossii) => (
          <button
            key={hossii.id}
            type="button"
            style={buttonStyle}
            onClick={() => showSingle(hossii)}
          >
            1件表示: {hossii.authorName}
          </button>
        ))}

        <button
          type="button"
          style={{ ...buttonStyle, background: '#7c3aed' }}
          onClick={() => SAMPLE_HOSSIIS.forEach((h) => notify(h))}
        >
          3件連続到着（キュー）
        </button>
      </div>

      <NewHossiiToast
        hossii={single}
        show={singleShow}
        onClose={() => {
          setSingleShow(false);
          setSingle(null);
        }}
        onView={(h) => console.log('view hossii', h.id)}
      />

      {toast && (
        <NewHossiiToast
          hossii={toast.hossii}
          show={toast.show}
          onClose={close}
          onView={(h) => console.log('view hossii', h.id)}
        />
      )}
    </div>
  );
}
