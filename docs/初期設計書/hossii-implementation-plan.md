# Hossii Implementation Plan

Based on analysis of old-leapday-src, this plan adds missing Hossii behaviors to hossii-demo.

## Phase 1: Per-Emotion Animations (High Priority)

### 1.1 Add emotion animation classes to motion.css
**File**: `src/core/ui/motion.css`
**Action**: Add missing keyframes

```css
/* Add these keyframes */
@keyframes hossii-anim-wow { /* pop-up effect */ }
@keyframes hossii-anim-empathy { /* heart float */ }
@keyframes hossii-anim-inspire { /* bulb spread */ }
@keyframes hossii-anim-think { /* question wobble */ }
@keyframes hossii-anim-laugh { /* bounce up */ }
@keyframes hossii-anim-joy { /* heart float */ }
@keyframes hossii-anim-moved { /* slow tear rise */ }
@keyframes hossii-anim-fun { /* sparkle */ }
```

### 1.2 Update HossiiLive effect display
**File**: `src/components/Hossii/HossiiLive.module.css`
**Action**: Import and apply animation classes to effect element

## Phase 2: Tap Interaction (Medium Priority)

### 2.1 Make HossiiLive clickable
**File**: `src/components/Hossii/HossiiLive.tsx`
**Changes**:
- Add `onClick` handler to container
- Add `onTap` callback prop
- Trigger manual reaction on click
- Show random bubble on tap

### 2.2 Add cursor style
**File**: `src/components/Hossii/HossiiLive.module.css`
**Action**: Add `cursor: pointer` to container

## Phase 3: Quote Bubble (Medium Priority)

### 3.1 Add quote bubble component
**File**: `src/components/Hossii/HossiiLive.tsx`
**Changes**:
- Add `quoteBubble` state (longer content)
- Add `showQuote` state (5s duration)
- Render larger quote bubble above Hossii

### 3.2 Style quote bubble
**File**: `src/components/Hossii/HossiiLive.module.css`
**Action**: Add `.quoteBubble` styles (larger, more prominent)

## Phase 4: Autonomous Patrol (Optional)

### 4.1 Add patrol mode
**File**: `src/components/Hossii/HossiiLive.tsx`
**Changes**:
- Add `patrolEnabled` prop (default false)
- Add `HOSSII_SPOTS` array (simplified, 5 spots)
- Add 8-second interval for movement
- Use CSS transition for smooth movement

### 4.2 Add patrol styles
**File**: `src/components/Hossii/HossiiLive.module.css`
**Action**: Add `transition: left 4s, top 4s` for patrol mode

---

## Concrete File Changes

### File 1: `src/core/ui/motion.css`
```diff
+ /* Per-emotion effect animations */
+ @keyframes hossii-anim-wow {
+   0% { transform: translateY(8px) scale(0.6); opacity: 0; }
+   40% { transform: translateY(0) scale(1.1); opacity: 1; }
+   100% { transform: translateY(-12px) scale(1); opacity: 0; }
+ }
+ .hossii-anim-wow { animation: hossii-anim-wow 1.3s ease-out forwards; }
+
+ @keyframes hossii-anim-empathy {
+   0% { transform: translateY(12px) scale(0.8); opacity: 0; }
+   30% { transform: translateY(0) scale(1); opacity: 1; }
+   100% { transform: translateY(-20px) scale(1.05); opacity: 0; }
+ }
+ .hossii-anim-empathy { animation: hossii-anim-empathy 1.6s ease-out forwards; }
+
+ @keyframes hossii-anim-inspire {
+   0% { transform: translateY(4px) scale(0.7); opacity: 0; }
+   30% { transform: translateY(0) scale(1.1); opacity: 1; }
+   100% { transform: translateY(-10px) scale(1.3); opacity: 0; }
+ }
+ .hossii-anim-inspire { animation: hossii-anim-inspire 1.5s ease-out forwards; }
+
+ @keyframes hossii-anim-think {
+   0% { transform: translateY(6px) scale(0.8); opacity: 0; }
+   30% { transform: translateY(0) scale(1); opacity: 1; }
+   60% { transform: translateY(-4px) translateX(-3px); }
+   100% { transform: translateY(-8px) translateX(3px); opacity: 0; }
+ }
+ .hossii-anim-think { animation: hossii-anim-think 1.8s ease-out forwards; }
+
+ @keyframes hossii-anim-laugh {
+   0% { transform: translateY(8px) scale(0.8); opacity: 0; }
+   30% { transform: translateY(0) scale(1); opacity: 1; }
+   50% { transform: translateY(-4px); }
+   80% { transform: translateY(0); }
+   100% { transform: translateY(-8px); opacity: 0; }
+ }
+ .hossii-anim-laugh { animation: hossii-anim-laugh 1.4s ease-out forwards; }
+
+ @keyframes hossii-anim-joy {
+   0% { transform: translateY(12px) scale(0.8); opacity: 0; }
+   30% { transform: translateY(0) scale(1); opacity: 1; }
+   100% { transform: translateY(-20px) scale(1.05); opacity: 0; }
+ }
+ .hossii-anim-joy { animation: hossii-anim-joy 1.6s ease-out forwards; }
+
+ @keyframes hossii-anim-moved {
+   0% { transform: translateY(12px) scale(0.7); opacity: 0; }
+   30% { transform: translateY(0) scale(1); opacity: 1; }
+   100% { transform: translateY(-16px) scale(1.05); opacity: 0; }
+ }
+ .hossii-anim-moved { animation: hossii-anim-moved 1.9s ease-out forwards; }
+
+ @keyframes hossii-anim-fun {
+   0% { transform: scale(0.4); opacity: 0; }
+   30% { transform: scale(1.1); opacity: 1; }
+   100% { transform: scale(0.9) translateY(-16px); opacity: 0; }
+ }
+ .hossii-anim-fun { animation: hossii-anim-fun 1.3s ease-out forwards; }
```

### File 2: `src/components/Hossii/HossiiLive.tsx`
```diff
  type Props = {
    lastTriggerId?: string;
    emotion?: EmotionKey | null;
    onParticle?: (emotion: EmotionKey) => void;
+   onTap?: () => void;
  };

+ // Tap triggers manual reaction
+ const handleTap = () => {
+   if (onTap) onTap();
+   // Show random bubble
+   const emotions: EmotionKey[] = ['wow', 'joy', 'fun', 'empathy'];
+   const randomEmotion = emotions[Math.floor(Math.random() * emotions.length)];
+   setBubble(getRandomBubble8(randomEmotion));
+   setTimeout(() => setBubble(null), 1500);
+ };
```

### File 3: `src/components/Hossii/HossiiLive.module.css`
```diff
  .container {
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    z-index: 100;
    width: 5rem;
    height: 5rem;
    display: flex;
    align-items: center;
    justify-content: center;
+   cursor: pointer;
  }
```

---

## Implementation Order

1. **motion.css**: Add 8 emotion animation keyframes
2. **HossiiLive.module.css**: Add cursor pointer
3. **HossiiLive.tsx**: Add onTap handler

## Estimated Scope
- Lines of code: ~80 additions
- Files modified: 3
- Risk: Low (additive changes only)
