# Hossii Behavior Analysis - Old Leapday Codebase

## 1. Hossii States & Expressions

### 1.1 Mood States (HossiiMood)
```typescript
type HossiiMood = 'float' | 'happy' | 'tap';
```

| State | Expression | Duration | Trigger |
|-------|------------|----------|---------|
| `float` | normal | default | idle/recovery |
| `happy` | joy | 600-800ms | new post received |
| `tap` | talk | 900ms | user taps Hossii |

### 1.2 Expressions Available
From `hossiiAssets.ts`:
- `normal` - default idle face
- `talk` - speaking/responding
- `joy` - happy reaction
- `default` - fallback
- `smile` - gentle smile
- `open`, `open2` - open mouth variants
- `default2` - alt default

## 2. Animation Behaviors

### 2.1 Autonomous Movement (LeapdayScreen)
- **Patrol**: Moves between 10 predefined spots every 8 seconds
- **Transition**: CSS `4s ease-in-out` for smooth movement
- **Position**: % based (e.g., `{x: 78, y: 72}`)

```typescript
const HOSSII_SPOTS: HossiiSpot[] = [
  { x: 78, y: 72 }, { x: 70, y: 20 }, { x: 60, y: 45 },
  { x: 35, y: 18 }, { x: 22, y: 60 }, { x: 12, y: 30 },
  { x: 45, y: 75 }, { x: 85, y: 40 }, { x: 65, y: 10 },
  { x: 30, y: 50 },
];
```

### 2.2 Reaction Triggers

#### On New Post (Realtime)
1. Set mood to `happy`
2. Move to next spot
3. Show emotion-specific line (1 second)
4. Spawn burst effects
5. Return to `float` after 600ms

#### On Tap/Click
1. Set mood to `tap`
2. Move to next spot
3. Show random quote bubble (5 seconds)
4. Speak message aloud (Web Speech API)
5. Return to `float` after 900ms

#### Auto Quote (45 seconds interval)
1. Pick random message from actions
2. Show quote bubble
3. Speak message
4. Set mood to `happy` briefly (800ms)

### 2.3 Speech Bubbles

#### Short Line (hossiiLine)
- Duration: 1 second
- Content: Emotion-specific phrases
- Position: Above Hossii

```typescript
const HOSSII_LINES_BY_EMOTION_KEY: Record<string, string> = {
  wow: 'ぽよっ！？すご〜い！',
  empathy: 'じ〜ん…、いいねぇ',
  inspire: 'ぽかっ！ひらめいた〜！',
  think: 'ふむふむ…気になる〜',
  laugh: 'くふふ〜楽しいね！',
  joy: 'ぽよん♪しあわせ〜',
  moved: 'こころ…動いた…',
  fun: 'わ〜い！たのしい〜っ！',
};
```

#### Quote Bubble (hossiiQuote)
- Duration: 5 seconds
- Content: User-submitted message
- Shows: message, display_name, target info

## 3. CSS Animations (globals.css)

### 3.1 Character Animations
```css
/* Soft bounce on reaction */
@keyframes hossii-soft-bounce {
  0% { transform: translateY(0) rotate(0deg); }
  30% { transform: translateY(-10px) rotate(-3deg); }
  60% { transform: translateY(-6px) rotate(2deg); }
  100% { transform: translateY(0) rotate(0deg); }
}
/* Duration: 0.6s */
```

### 3.2 Button Effects
```css
/* Pop effect on button press */
@keyframes hoshii-pop {
  0% { transform: scale(1); }
  40% { transform: scale(1.12); }
  100% { transform: scale(1); }
}
/* Duration: 180ms */

/* Burst ring effect */
@keyframes hoshii-burst {
  0% { transform: scale(0.4); opacity: 0.9; }
  60% { transform: scale(1); opacity: 0.6; }
  100% { transform: scale(1.4); opacity: 0; }
}
/* Duration: 420ms */
```

### 3.3 Emotion Effects (per emotion type)
| Emotion | Animation | Duration | Description |
|---------|-----------|----------|-------------|
| wow | hoshii-pop-up | 1.3s | Pop up from below |
| empathy | hoshii-heart | 1.6s | Float up slowly |
| inspire | hoshii-bulb | 1.5s | Light spread |
| think | hoshii-question | 1.8s | Wobble up |
| laugh | hoshii-lol | 1.4s | Bounce up |
| moved | hoshii-tear | 1.9s | Slow rise |

### 3.4 Particle Effects
```css
/* Star burst */
@keyframes hossii-burst-star {
  0% { transform: scale(0.4) translateY(6px); opacity: 0; }
  30% { transform: scale(1.1) translateY(0); opacity: 1; }
  100% { transform: scale(0.9) translateY(-16px); opacity: 0; }
}
/* Duration: 1.3s */
```

### 3.5 Loading Animation
```css
@keyframes hossii-dot-bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-2px); opacity: 1; }
}
/* Duration: 900ms infinite */
```

## 4. Current Demo Implementation Status

### Already Implemented in hossii-demo:
- [x] 8 emotions with emoji/bubble mappings
- [x] HossiiLive component (bottom-right)
- [x] Collect-and-place animation
- [x] Particle effects on emotion
- [x] Basic expression switching
- [x] Soft bounce animation
- [x] Speech bubble (short line)

### Not Yet Implemented:
- [ ] Autonomous patrol (spot-to-spot movement)
- [ ] Auto-quote feature (45s interval)
- [ ] Quote bubble (long, 5s)
- [ ] Tap interaction (click to trigger)
- [ ] Web Speech API integration
- [ ] Per-emotion animation classes (wow, heart, etc.)
- [ ] Button burst effect

## 5. Recommended Enhancements for Demo

### Priority 1 - High Impact, Low Effort
1. **Tap interaction**: Make HossiiLive clickable for manual trigger
2. **Per-emotion animations**: Add CSS animation classes

### Priority 2 - Medium Effort
3. **Autonomous patrol**: Optional wandering mode
4. **Quote bubble**: Show actual post content

### Priority 3 - Nice to Have
5. **Web Speech API**: Audio feedback (optional)
6. **Background glow**: Activity level indicator
