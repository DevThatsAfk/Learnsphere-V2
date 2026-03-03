# LearnSphere — Full Codebase Audit & Gap Analysis
**Target:** AMD Slingshot PS-2 (AI in Education & Skilling)

---

## 🏗️ 1. Project Structure Overview
LearnSphere is a full-stack web application. It uses a modern monorepo-style structure split into a frontend client and a backend API server.

- **`client/` (Frontend)**
  - React 18, Vite, TypeScript, Tailwind CSS, Recharts.
  - `src/components/`: Reusable UI (`ui.tsx`), layout (`AppShell.tsx`), and specialized components (`NotesPanel.tsx`).
  - `src/pages/`: Core application views (`DashboardPage`, `SessionsPage`, `SmartNotesPage`, `ReviewsPage`, etc.).
  - `src/lib/api.ts`: Centralized API wrapper handling auth tokens and requests using `axios`.
  - `src/context/`: Global React state (e.g., `AuthContext`, `SubjectsContext`).

- **`server/` (Backend)**
  - Node.js, Express, TypeScript, Prisma ORM, PostgreSQL.
  - `src/index.ts`: Entry point, express app setup, and router mounting.
  - `src/routes/`: Express routers organized by resource (`auth`, `subjects`, `tasks`, `sessions`, `exams`, `analytics`, `notes`, `reviews`, `summarize`, `generate`).
  - `src/services/`: Core business logic and database interactions.
  - `src/middleware/`: Authentication (`auth.ts`) and unified error handling (`errorHandler.ts`).
  - `prisma/schema.prisma`: The definitive database schema.

---

## 🗄️ 2. Database Schema Analysis
The database is structured well for a study tracking app, but has a few minor limitations for long-term scalability.

**Models:**
- `User`: Standard auth entity.
- `Subject`: The core organizational unit for everything else.
- `Task` & `TaskChecklist`: For to-do lists within a subject.
- `StudySession`: Tracks time, topic, and post-session reflection. 
- `Exam` & `ExamMark`: Tracks academic performance.
- `ReviewItem` & `Flashcard`: Implements Spaced Repetition (SRS).
- `Note`: User-authored study material.
- `AnalyticsSnapshot`: Denormalized aggregate data for the dashboard.

**Design Issues & Notes:**
1. **Hard Deletes**: All relations use `onDelete: Cascade`. Deleting a subject wipes out *everything* associated with it instantly. No soft-delete (`isDeleted: boolean`) mechanism exists, which limits recovery if a user makes a mistake.
2. **Flashcard Recall Aggregation**: The `Flashcard` model lacks an individual `recallStrength` field. Recall strength is aggregated directly up to the `ReviewItem` via business logic in `reviewService.ts`. While this keeps the schema simple, it prevents the app from knowing *which specific question* in a topic was consistently weak vs strong.
3. **Analytics Sync**: `AnalyticsSnapshot` relies on application-level logic to update. If a bug prevents the update logic from running after a session/exam, the dashboard goes out of sync with raw data.

---

## 🗺️ 3. API Endpoint Map
All endpoints expect `Authorization: Bearer <token>` unless marked (Public).

| Route | Method | Purpose |
|---|---|---|
| `/api/auth/register` | POST | (Public) Create new user account. |
| `/api/auth/login` | POST | (Public) Authenticate user, return JWT. |
| `/api/auth/me` | GET | Verify JWT, return user profile. |
| `/api/subjects` | GET/POST | List user subjects / Create a subject. |
| `/api/subjects/:id` | PATCH/DELETE | Update / Delete subject. |
| `/api/tasks` | GET/POST | List tasks by subject / Create task. |
| `/api/tasks/:id` | PATCH/DELETE | Update task (including checklist) / Delete task. |
| `/api/sessions` | POST | Start a new study/revision session. |
| `/api/sessions/:id/end` | POST | End session, log active time & reflection. |
| `/api/exams` | GET/POST | List exams / Create an exam. |
| `/api/exams/:id/marks` | POST | Log marks for a subject in an exam. |
| `/api/analytics/dashboard` | GET | Get cumulative dashboard metrics. |
| `/api/notes` | GET/POST | Fetch notes by subject / Create note. |
| `/api/notes/:id` | PATCH/DELETE | Update / Delete note. |
| `/api/reviews` | GET/POST | Fetch review queue sorted by weakness / Create topic. |
| `/api/reviews/:id/flashcards` | GET/POST | Fetch / Add flashcards to a review item. |
| `/api/reviews/:id/flashcards/:cid`| POST | Submit a recall rating (`WEAK`, `MODERATE`, `STRONG`). |
| `/api/summarize` | POST | AI text summarization (Smart Notes Booster). |
| `/api/generate/flashcards` | POST | AI Generation of 5 flashcards from user notes. |
| `/api/generate/quiz` | POST | AI Generation of a 3-question MCQ quiz from notes. |

---

## 🐛 4. Bug Report & Missing Implementations
| Severity | Issue | Location |
|---|---|---|
| **High** | **No Pagination / Limits** | All `GET` list endpoints (notes, tasks, reviews). A user with 1,000 notes will fetch all 1,000 at once, causing massive overhead and slow UI. |
| **Medium** | **Type Safety Bypass (`any`)** | `SessionsPage.tsx` uses `any[]` for the `dynamicQuiz` state, defeating TS compile-time guarantees for the AI output format. |
| **Medium** | **Rate Limiting Missing** | AI endpoints (`/summarize`, `/generate/*`) have no rate limits applied. A malicious user could spam requests, depleting the Gemini API quota or racking up bills. |
| **Low** | **Flashcard Add Validation** | User can theoretically submit empty strings for AI generation if whitespace bypasses the length checks. |

---

## 🧹 5. Code Quality Issues
- **Excellent Separation of Concerns**: The backend strictly follows Route -> Controller(inline) -> Service.
- **Unified Error Handling**: The custom `ApiError` class and wrapper `asyncHandler` are implemented cleanly globally.
- **Stateless AI**: AI features do not automatically persist hallucinations into the database, respecting user ownership and data purity (great architectural choice).
- **Missing Loading Skeletons**: Some page transitions rely entirely on spinners instead of optimistic UI updates or skeleton lists.

---

## 🔒 6. Security Audit
1. **Authentication:** Standard JWT implementation.
2. **Developer Backdoors:** The `.env.example` mentions `DEV_BYPASS_AUTH="false"`. If this code makes it to production, it's a severe vulnerability. Validate that this is stripped securely.
3. **Data Isolation:** All service functions verify user ownership appropriately (e.g. `assertReviewOwnership` verifies the subject belongs to the user). No obvious IDOR (Insecure Direct Object Reference) vulnerabilities exist.
4. **Input Validation:** Input is validated manually in routes (e.g., checking `.trim().length`). A library like `zod` would provide much stronger guarantees, especially for complex objects.

---

## 🎯 7. PS-2 Gap Analysis (AI in Education & Skilling)
**Theme:** "AMD Slingshot PS-2: AI in Education & Skilling"

**Current State vs Goal:**
LearnSphere is currently a fantastic *Study Tracker* with lightweight AI augmentations (Smart Notes, AI Flashcards/Quizzes). However, to win a pitch explicitly focused on "Education & Skilling," it needs to transition from a *passive tool* to an *active mentor*.

**Missing Features (Gap):**
1. **Skill Gap Diagnostics (Medium Effort):** 
   - *Issue*: AI doesn't know what the user is bad at overall, only specific flashcards. 
   - *Fix*: An AI agent that looks at `AnalyticsSnapshot` and `ReviewItem` data to generate a "Weekly Skill Report" identifying exactly where the student is failing.
2. **Adaptive Learning Paths (High Effort):**
   - *Issue*: Tasks and study plans are entirely manual.
   - *Fix*: AI feature that breaks down a complex subject into a daily schedule of tasks based on the user's exam date.
3. **Conversational Tutor (High Effort):**
   - *Issue*: Interactions are transactional (click button -> get summary). 
   - *Fix*: A "Tutor Mode" panel where users can chat with an AI specifically grounded in their Notes and previous mistakes. 

---

## 🚀 8. Fix Priority List (Pre-Hackathon Demo)

1. **Fix `any` Types in UI (Priority: Critical)**
   - *File*: `client/src/pages/SessionsPage.tsx`
   - *Action*: Replace `const [dynamicQuiz, setDynamicQuiz] = useState<any[] | null>(null);` with the proper `AIQuizQuestion[]` type imported from `api.ts`.
2. **Implement Rate Limiting on AI Routes (Priority: High)**
   - *File*: `server/src/index.ts`
   - *Action*: Install `express-rate-limit` and apply it to `/api/generate/*` and `/api/summarize` to prevent demo failures due to API exhaustion.
3. **Add "Skill Gap / Insights" UI element (Priority: Medium)**
   - *File*: `client/src/pages/DashboardPage.tsx`
   - *Action*: Add a small "AI Insights" card explicitly utilizing the term "Skill Mapping" or "Skill Diagnostics" to hit the keywords for the AMD SlingShot PS-2 pitch.
4. **Address `DEV_BYPASS_AUTH` (Priority: Medium)**
   - *File*: `server/src/middleware/auth.ts`
   - *Action*: Add a strict environment check: `if (process.env.NODE_ENV === 'production' && bypassAuth) throw Error(...)` to ensure the backdoor cannot be enabled on a live demo server.
5. **Add Max-Height / Overflow to Notes Panel (Priority: Low)**
   - *File*: `client/src/components/NotesPanel.tsx`
   - *Action*: Under heavy use, the notes list can stretch the page infinitely. Add `max-h-96 overflow-y-auto` to the note container.
