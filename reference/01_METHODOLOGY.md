# LearnSphere Development Methodology

This document outlines the engineering process and design philosophy used during the LearnSphere upgrade project.

## 1. Governance & Constraints
All development follows a strict "Additive & Non-Destructive" rule:
- **Backend Stability**: Existing logic is preserved. New features extend the service layer without breaking existing API contracts.
- **Stateless AI**: AI features (Summarizer, Flashcard Generator) are designed as stateless transformations. They do not maintain a memory of user data outside the immediate context window, ensuring privacy and reliability.
- **Frontend Source of Truth**: The React frontend must always treat the Backend as the only source of truth (no local-only mock state for core data).

## 2. The Multi-Phase Workflow

### Phase A: Architecture Hardening
1. **Schema-First Backend**: Every new feature begins with a Prisma schema update.
2. **Service Layer Isolation**: Business logic is encapsulated in `src/services/` to keep route handlers clean and testable.
3. **Type Safety**: TypeScript interfaces are updated in both `server/src` and `client/src/types/api.ts` before UI development begins.

### Phase B: UI System Transformation
The project underwent a significant "Gloomy to Energetic" overhaul:
- **Dark Mode to Light Academic**: Transitioning from a dark slate theme to a high-contrast white/indigo/emerald palette.
- **Component Reusability**: Extracting complex UI patterns (like the `NotesPanel` and `ProgressBar`) into standalone components.
- **Micro-interactions**: Adding HMR-friendly animations (fade-in, slide-up) and state indicators (auto-save status).

## 3. Tooling & Verification
- **TSC Verification**: Every feature implementation is followed by `npx tsc --noEmit` on both client and server to ensure zero regressions.
- **HMR Testing**: React components are built iteratively with Hot Module Replacement to ensure state persistence during development.
- **Prisma Migrations**: Used for all database changes to ensure environment consistency.

---
**Prepared for**: Junior Engineering Reference
**Date**: February 2026
