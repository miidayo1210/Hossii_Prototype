import { Maximize2, Minimize2, Eye, EyeOff, Mic, MicOff, Volume2, VolumeX, ZoomIn } from 'lucide-react';
import type { DisplayScale } from '../../core/utils/displayScaleStorage';
import styles from './LeftControlBar.module.css';

export type ControlState = {
  isFullscreen: boolean;
  hossiiVisible: boolean;
  micEnabled: boolean;
  voiceEnabled: boolean;
};

type Props = {
  controls: ControlState;
  onToggle: (key: keyof ControlState) => void;
  onFullscreenToggle: () => void;
  displayScale: DisplayScale;
  onDisplayScaleCycle: () => void;
};

export const LeftControlBar = ({ controls, onToggle, onFullscreenToggle, displayScale, onDisplayScaleCycle }: Props) => {
  // DisplayScale を % 表示に変換
  const scalePercent = Math.round(displayScale * 100);

  return (
    <aside className={styles.controlBar}>
      <button
        className={`${styles.controlButton} ${controls.isFullscreen ? styles.active : ''}`}
        onClick={onFullscreenToggle}
        aria-label="画面サイズ調整"
        title="画面サイズ調整"
      >
        {controls.isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
      </button>

      <button
        className={`${styles.controlButton} ${controls.hossiiVisible ? styles.active : ''}`}
        onClick={() => onToggle('hossiiVisible')}
        aria-label="Hossii表示"
        title="Hossii表示"
      >
        {controls.hossiiVisible ? <Eye size={20} /> : <EyeOff size={20} />}
      </button>

      <button
        className={`${styles.controlButton} ${controls.micEnabled ? styles.active : ''}`}
        onClick={() => onToggle('micEnabled')}
        aria-label="マイク/音声"
        title="マイク/音声"
      >
        {controls.micEnabled ? <Mic size={20} /> : <MicOff size={20} />}
      </button>

      <button
        className={`${styles.controlButton} ${controls.voiceEnabled ? styles.active : ''}`}
        onClick={() => onToggle('voiceEnabled')}
        aria-label="Hossiiの声"
        title="Hossiiの声"
      >
        {controls.voiceEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
      </button>

      <button
        className={styles.controlButton}
        onClick={onDisplayScaleCycle}
        aria-label="表示サイズを変更"
        title="表示サイズを変更"
      >
        <ZoomIn size={20} />
        <span className={styles.scaleLabel}>{scalePercent}%</span>
      </button>
    </aside>
  );
};
