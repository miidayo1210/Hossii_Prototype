# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production (runs tsc + vite build)
npm run lint     # Run ESLint
npm run preview  # Preview production build
```

## Architecture

### Directory Structure
- `src/core/` - Production-ready core logic (types, hooks, utils)
- `src/demo/` - Demo-specific code (mock data)
- `src/components/` - UI components organized by screen

### Key Patterns

**State Management**: React Context + useReducer pattern in `src/core/hooks/useHossiiStore.tsx`. Designed for easy migration to Zustand.

**Routing**: Hash-based routing via `src/core/hooks/useRouter.ts`. Screens are `#post` and `#screen`.

**Data Types**: Core types defined in `src/core/types/index.ts`. Main entity is `Hossii` (feeling/emotion post).

### Naming Conventions
- Use "Demo" and "Core" for layer naming
- Do not use "Leapday"

### Future Additions
- Emotion/Hossii expression system (to be added incrementally)
- Supabase integration (demo currently uses mock data only)
