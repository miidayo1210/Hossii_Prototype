import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import styles from './TutorialOverlay.module.css';

type Props = {
  userId: string;
  onComplete: () => void;
};

type TutorialStep = {
  id: number;
  message: string;
  highlight?: 'post' | 'hossii' | null;
};

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 1,
    message: 'やっほー！ここはあなたのスペースだよ ✨',
    highlight: null,
  },
  {
    id: 2,
    message: 'ここから気持ちを置けるよ。\nタップしてみてね！',
    highlight: 'post',
  },
  {
    id: 3,
    message: 'ボクをタップすると、\nいろんなことができるよ！',
    highlight: 'hossii',
  },
  {
    id: 4,
    message: 'それじゃあ、楽しんでね！\nいつでもここにいるからね 💫',
    highlight: null,
  },
];

export const TutorialOverlay = ({ userId, onComplete }: Props) => {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Tutorial complete
      localStorage.setItem(`hossii_tutorial_seen_${userId}`, 'true');
      onComplete();
    }
  };

  const step = TUTORIAL_STEPS[currentStep];
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;

  return (
    <div className={styles.overlay}>
      {/* Darkened background */}
      <div className={styles.backdrop} onClick={handleNext}></div>

      {/* Hossii character */}
      <div className={styles.hossiiContainer}>
        <div className={styles.hossii}>🐟</div>
      </div>

      {/* Message bubble */}
      <div className={styles.messageContainer}>
        <div className={styles.messageBubble}>
          <p className={styles.message}>{step.message}</p>

          <button
            className={styles.nextButton}
            onClick={handleNext}
          >
            {isLastStep ? '完了' : '次へ'}
            {!isLastStep && <ChevronRight size={20} />}
          </button>
        </div>

        {/* Step indicator */}
        <div className={styles.stepIndicator}>
          {TUTORIAL_STEPS.map((_, index) => (
            <div
              key={index}
              className={`${styles.stepDot} ${
                index === currentStep ? styles.stepDotActive : ''
              }`}
            />
          ))}
        </div>
      </div>

      {/* Highlight indicators */}
      {step.highlight === 'post' && (
        <div className={styles.highlightPost}>
          <div className={styles.arrow}>↑</div>
        </div>
      )}

      {step.highlight === 'hossii' && (
        <div className={styles.highlightHossii}>
          <div className={styles.arrow}>↓</div>
        </div>
      )}
    </div>
  );
};
