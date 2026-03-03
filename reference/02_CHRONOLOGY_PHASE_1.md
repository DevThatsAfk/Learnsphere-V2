# Chronology: Initial 6 Features

This log covers the first major upgrade of the LearnSphere platform.

## Feature 1: Authoritative Session Timer
- **Objective**: Create a study timer that users cannot "cheat" by tab-switching.
- **Implementation**:
    - Built a robust timer in `SessionsPage.tsx` using `setInterval` and `useRef`.
    - Added `visibilitychange` listeners to auto-pause when the user leaves the tab.
    - Result: Accurate tracking of "active focus time".

## Feature 2: Integrated Review Flow
- **Objective**: Seamless transition from study to reflection.
- **Implementation**:
    - Created a 4-step state machine: `Session` -> `Flashcards` -> `Quiz` -> `Reflection`.
    - Automated the creation of `ReviewItems` based on the session topic.

## Feature 3: Revision Queue (Recall Priority)
- **Objective**: Surface weakest topics for spaced repetition.
- **Implementation**:
    - Redesigned `ReviewsPage.tsx` to sort topics by `RecallStrength` (Weak -> Moderate -> Strong).
    - Added "Reveal Answer" interaction pattern for active recall.

## Feature 4: Context Summarizer (AI Transformation)
- **Objective**: Instant bullet-point summaries of study material.
- **Implementation**:
    - Integrated Google Gemini API via a stateless `summarizeApi`.
    - Enforced a 20,000 character limit and bullet-point-only output.

## Feature 5: Global Subject Context
- **Objective**: Fix inconsistent subject names across the app.
- **Implementation**:
    - Introduced `SubjectsContext.tsx` to provide a single source of truth for all components.
    - Implemented a `PATCH /subjects/:id` API for real-time renaming.

## Feature 6: Graphical Analytics Upgrade
- **Objective**: Data visualization for student motivation.
- **Implementation**:
    - Rebuilt the **Consistency Heatmap** as a proper Monday-aligned calendar grid.
    - Added the **Marks Bar Chart** (Sorted weakest-first, colour-coded by grade zones).

---
*All features verified with 100% TypeScript compliance.*
