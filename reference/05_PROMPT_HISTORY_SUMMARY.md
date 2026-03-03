# Prompt History Summary (Major Milestones)

Common patterns and specific requests that shaped the LearnSphere architecture.

## Milestone 1: The "No-Reset" Timer
**User Prompt**: *"I need a session timer that continues ticking in the background but pauses if I leave the tab. It must be authoritative."*
**Engineering Solution**: Used a combination of `useRef` for interval IDs and `useEffect` with `visibilitychange` listeners. Persisted the start time so refreshes don't reset the countdown (local session state).

## Milestone 2: The Global Context Fix
**User Prompt**: *"Renaming a subject in the subjects page doesn't update names in other pages. Fix this."*
**Engineering Solution**: This required a shift from local "fetch-on-load" models to a **Context Provider Pattern**. Created `SubjectsContext.tsx` which handles the API calls and provides a shared observable state.

## Milestone 3: The Light Mode Pivot
**User Prompt**: *"The current UI feels gloomy and sleepy. Make it bright, energetic, and academic."*
**Engineering Solution**: A "CSS Token Surgery". Instead of touching every JSX file, we redefined colors at the `tailwind.config.js` and `index.css` levels. This allowed a 100% UI transformation in minutes without breaking logic.

## Milestone 4: Note Extraction (Current)
**User Prompt**: *"Flashcards and quizzes must be grounded ONLY in user-uploaded notes. No hallucination."*
**Engineering Solution**: Implementing a system where the AI prompt includes a specific "Strict Context" header, and the backend validates that the `Note` content is passed as the ONLY input source.

---
*Methodology Note: Always check `API_CONTRACTS.md` before adding new prompts to ensure schema alignment.*
