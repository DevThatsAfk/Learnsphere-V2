# Antigrav Prompt — LearnSphere Phase 2 Continuation
## Feature: File Upload + Anti-Hallucination AI Generation

---

## PASTE THIS INTO ANTIGRAV:

---

You are continuing development on **LearnSphere**, a full-stack study platform built with React 18 + TypeScript + Tailwind CSS (frontend) and Node.js + Express + Prisma + PostgreSQL (backend). The AI service uses **Google Gemini 1.5 Flash**.

I am uploading a detailed implementation guide (`LEARNSPHERE_IMPLEMENTATION_GUIDE.md`). Follow it exactly, step by step. Do not skip steps. Do not change the tech stack.

---

### CONTEXT: WHERE WE ARE

The project has already completed:
- A full UI overhaul (dark → light academic theme: white cards, indigo/emerald palette, `tailwind.config.js` tokens)
- `NotesPanel.tsx` component with auto-save and debounced saving, integrated into `SessionsPage.tsx`
- A 4-step session state machine: `Session → Flashcards → Quiz → Reflection`
- AI flashcard and quiz generation from typed notes via Gemini (basic, without validation)
- `SubjectsContext.tsx` for global subject state
- `ReviewsPage.tsx` with Recall Strength sorting
- All backend routes: `auth`, `subjects`, `tasks`, `sessions`, `exams`, `analytics`, `notes`, `reviews`, `summarize`, `generate`

---

### WHAT YOU ARE BUILDING NOW

Implement all 10 steps from the uploaded `LEARNSPHERE_IMPLEMENTATION_GUIDE.md` in this exact order:

**Step 1 — Install dependencies (backend)**
```
cd server && npm install multer @types/multer express-rate-limit zod
```

**Step 2 — Create `server/src/middleware/upload.ts`**
Multer configuration using `memoryStorage()` (no disk writes — buffer goes straight to Gemini). Allow only: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`, `text/plain`. Hard reject everything else with a clean error. Max file size: 10MB.

**Step 3 — Add rate limiting in `server/src/index.ts`**
Use `express-rate-limit`. Apply to `/api/generate` and `/api/summarize`. Limit: 10 requests per user per 15 minutes. Key by `req.userId` (from auth middleware), fall back to `req.ip`. Add this BEFORE the route registrations.

**Step 4 — Create `server/src/schemas/aiSchemas.ts`**
Define Zod schemas for:
- `FlashcardSchema`: `{ question: string (5–500 chars), answer: string (3–1000 chars) }`
- `FlashcardsResponseSchema`: `{ flashcards: FlashcardSchema[] (1–10 items) }`
- `QuizQuestionSchema`: `{ question: string, options: string[4], correctAnswer: number (0–3), explanation?: string }`
- `QuizResponseSchema`: `{ questions: QuizQuestionSchema[] (1–5 items) }`
Export TypeScript types: `AIFlashcard`, `AIQuizQuestion`.

**Step 5 — Update `server/src/services/geminiService.ts`**
Add a `STRICT_GROUNDING_INSTRUCTION` constant prepended to all AI prompts. This must explicitly tell the model:
1. Only use information from the provided source material
2. Do NOT add external knowledge or facts not in the source
3. Do NOT invent Q&As — if source is too short, generate fewer items
4. Respond ONLY with valid JSON matching the exact schema — no markdown fences, no preamble

Add three functions:
- `generateFlashcardsFromFile(buffer, mimeType, count)` — for PDF/image/text uploads
- `generateQuizFromFile(buffer, mimeType, count)` — for PDF/image/text uploads
- `generateFlashcardsFromText(noteContent)` — existing text flow, now with Zod validation added

For PDF and images: use Gemini's `inlineData` (base64 encoded buffer). For plain text: embed directly in the prompt string (slice to 50,000 chars max).

After getting the Gemini response: strip any ```json fences, parse JSON, run through the appropriate Zod schema with `.safeParse()`. If validation fails, throw a clean `ApiError` — never pass bad data to the DB.

**Step 6 — Create `server/src/routes/upload.ts`**
Single route: `POST /api/upload/generate`
- Protected by `authenticate` middleware
- Uses `upload.single('file')` from the multer middleware
- Accepts body fields: `type` (enum: `flashcards` | `quiz` | `both`, default: `both`), `flashcardCount` (default: 5), `quizCount` (default: 3)
- Returns: `{ flashcards?, quiz?, fileInfo: { name, size, type } }`
- If no file: throw `ApiError(400, 'No file uploaded')`

**Step 7 — Register the upload route in `server/src/index.ts`**
```typescript
import uploadRouter from './routes/upload';
app.use('/api/upload', uploadRouter);
```

**Step 8 — Update `client/src/types/api.ts`**
Add interfaces:
```typescript
export interface AIFlashcard {
  question: string;
  answer: string;
}

export interface AIQuizQuestion {
  question: string;
  options: string[]; // Always exactly 4
  correctAnswer: number; // 0-based index
  explanation?: string;
}
```

**Step 9 — Fix `any[]` type in `client/src/pages/SessionsPage.tsx`**
Find: `useState<any[] | null>(null)` used for the quiz state.
Replace with: `useState<AIQuizQuestion[] | null>(null)`
Import `AIQuizQuestion` from `'../types/api'`.
Run `npx tsc --noEmit` in the client directory to confirm zero TypeScript errors after this change.

**Step 10 — Add `FileUploadGenerator` component to `client/src/pages/SmartNotesPage.tsx`**

Build a self-contained component inside this file with:

UI elements:
- Section heading: "Generate from File"
- Subtext explaining the anti-hallucination guarantee: "strictly from your content"
- A styled click-to-upload drop zone (dashed indigo border, hover state changes to `border-indigo-400 bg-indigo-50`)
- File type icon that changes based on selected file (PDF → red FileText icon, image → emerald Image icon, text → slate FileText icon)
- Show file name and size after selection
- A "Generate Flashcards & Quiz" button (disabled while loading, shows spinner + "Generating…" text while in-flight)
- Error display: red alert box with AlertCircle icon for API errors or file validation errors
- Results section for flashcards: indigo-tinted cards, each showing Q and A
- Results section for quiz: emerald-tinted cards, each showing question + 4 options with the correct answer highlighted in `bg-emerald-200`
- Both results sections use `max-h-80 overflow-y-auto` to prevent infinite page expansion

State:
- `file: File | null`
- `loading: boolean`
- `error: string | null`
- `flashcards: AIFlashcard[] | null`
- `quiz: AIQuizQuestion[] | null`

API call: POST to `/upload/generate` using `FormData`, `Content-Type: multipart/form-data`. Use the existing `api` axios instance from `../lib/api`.

Client-side validation before upload:
- File size > 10MB → show error, don't upload
- No file selected → button stays disabled

Place `<FileUploadGenerator />` inside the SmartNotesPage layout, below the existing summarizer section. Use the same card styling (`className="card p-6 space-y-4"`) to match the existing UI system.

---

### ADDITIONAL FIXES (implement these after the 10 steps)

**Fix A — Auth bypass production guard (`server/src/middleware/auth.ts`)**
Find the `DEV_BYPASS_AUTH` logic. Wrap it with:
```typescript
if (process.env.NODE_ENV === 'production' && bypassAuth) {
  throw new Error('FATAL: DEV_BYPASS_AUTH cannot be enabled in production.');
}
```
This throws at startup, not at request time — so a misconfigured prod server fails loudly immediately.

**Fix B — NotesPanel overflow (`client/src/components/NotesPanel.tsx`)**
Find the container div that renders the list of past notes. Add `max-h-96 overflow-y-auto pr-1` to it. Find the `<textarea>` for note input. Add `max-h-48 resize-y` to it.

---

### CONSTRAINTS — DO NOT VIOLATE THESE

1. **Do not use disk storage for uploads.** Multer must use `memoryStorage()`. Files go buffer → Gemini → response. Nothing is written to disk.
2. **Do not skip Zod validation.** Every Gemini response must pass `.safeParse()` before any data is returned to the frontend or written to the DB. Never use the raw Gemini text directly.
3. **Do not change existing API contracts.** The existing `/api/generate/flashcards` and `/api/generate/quiz` routes must continue to work exactly as before. Only add the new `/api/upload/generate` route.
4. **Do not use `any` types.** After Step 9, there must be zero `any` types in the quiz/flashcard state or component props.
5. **Maintain the light academic UI theme.** New components use `card`, `btn-primary` classes and indigo/emerald color tokens from the existing design system. No dark backgrounds, no grey cards.
6. **TypeScript compliance.** After all changes, `npx tsc --noEmit` must pass with zero errors in both `client/` and `server/`.

---

### VERIFICATION CHECKLIST

After completing all steps, confirm:

- [ ] `npx tsc --noEmit` passes in both `client/` and `server/`
- [ ] Uploading a PDF to SmartNotesPage returns 5 flashcards and 3 quiz questions
- [ ] Uploading a JPG/PNG (handwritten notes photo) returns content extracted from the image
- [ ] Uploading a `.txt` file returns content grounded in that file's text
- [ ] Uploading a 15MB file shows a client-side error (too large) without hitting the server
- [ ] Uploading a `.docx` file shows an error: "Unsupported file type"
- [ ] Sending 11 requests to `/api/generate` in 15 minutes returns a 429 on the 11th
- [ ] `DEV_BYPASS_AUTH=true` with `NODE_ENV=production` crashes the server on startup with a fatal error
- [ ] Long notes in NotesPanel no longer expand the page infinitely (scroll appears at ~384px height)
- [ ] The generated quiz shows correct answer highlighted in emerald in the UI

---

### FILE REFERENCE

The uploaded `LEARNSPHERE_IMPLEMENTATION_GUIDE.md` contains the complete code for every file that needs to be created or modified. Use it as the authoritative source for exact implementations. If anything in this prompt conflicts with the guide, the guide wins.
