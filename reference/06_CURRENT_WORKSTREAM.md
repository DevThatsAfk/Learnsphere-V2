# Current Workstream: Phase 2 Upgrades

This document tracks the live progress of the "UX, Learning Quality & Flow" features (started Feb 24).

## ✅ COMPLETED (Done & Verified)

### 1. UI Aesthetic Overhaul
- **Scope**: Transforming "Gloomy" dark UI into "Energetic" Light Academic UI.
- **Work Done**:
    - Overhauled `tailwind.config.js` with light-mode surfaces and vibrant indigo/emerald colors.
    - Rewrote `src/index.css` to implement high-contrast white cards, indigo gradients, and crisp typography.
    - Updated `LoginPage.tsx` with a mesh-gradient "wow" factor.
    - Redesigned `AppShell.tsx` with a minimalist light sidebar.

### 2. Study Notes Foundation (Core Feature 2/3)
- **Scope**: Persistent, user-owned study notes.
- **Work Done**:
    - **Backend**: Added `Note` model to Prisma schema (user+subject linked).
    - **API**: Implemented `GET/POST/PATCH/DELETE` endpoints in `notesRouter`.
    - **Client**: Added `notesApi` and `Note` types to the frontend.
    - **Component**: Built `NotesPanel.tsx` (Auto-save, debounced save, manual bullets, past-notes manager).
    - **Integration**: Injected live notes panel into `SessionsPage.tsx` (Active session view).

---

## 🚧 IN PROGRESS (Active Task)

### 2. Study Notes Panel (Completion)
- **Remaining Steps**:
    1.  **ReviewsPage Integration**: Embed the `NotesPanel` while the user is practicing flashcards.
    2.  **Session End Integration**: Embed the `NotesPanel` in the final "Reflection" step of the session end flow.

---

## 📅 YET TO DO (Next Steps)

### 3. Auto-Generated Flashcards & Quizzes from Notes
- **Procedure**:
    1.  Update `geminiService` on the backend to accept `noteContent` as a parameter.
    2.  Modify AI prompt to strictly ground answers in the provided note text.
    3.  Add "Generate from Notes" button in the Post-Session flashcard step.

### 4. Study Session -> Revision Button Fix
- **Procedure**:
    1.  Identify the non-functional "Revision" button in the `SessionsPage` start form.
    2.  Implement a router push to `/reviews` prepopulated with the selected subject.

### 5. Smart Notes Booster (Summarizer Upgrade)
- **Procedure**:
    1.  Rename `SummarizerPage.tsx` to `SmartNotesPage.tsx`.
    2.  Implement File Upload (PDF/Text) capability.
    3.  Update the AI prompt to output bulleted "Key Topics" and "Revision Points" instead of paragraphs.

---
**Current Focus**: Completing the UI integration of the Notes Panel across all learning contexts.
