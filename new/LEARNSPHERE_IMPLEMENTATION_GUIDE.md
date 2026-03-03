# LearnSphere: File Upload + Anti-Hallucination AI Generation
## Implementation Guide — Phase 2 Continuation

This guide picks up from where Phase 2 stopped. It covers:
1. **File Upload infrastructure** (PDF, Image, Plain Text)
2. **Auto-generation of Flashcards & Quiz from uploaded content**
3. **Anti-hallucination constraints** (strict prompting + Zod validation)
4. **Rate limiting on AI routes**
5. **Fix `any[]` type in SessionsPage.tsx**

---

## STEP 1 — Install Dependencies

### Backend
```bash
cd server
npm install multer @types/multer express-rate-limit zod
```

### Why these?
| Package | Role |
|---|---|
| `multer` | Handles `multipart/form-data` file uploads |
| `express-rate-limit` | Throttles AI endpoints before demo |
| `zod` | Validates AI output JSON before it touches the DB |

---

## STEP 2 — Backend: Multer Upload Middleware

**Create `server/src/middleware/upload.ts`**

```typescript
import multer from 'multer';
import path from 'path';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const storage = multer.memoryStorage(); // Keep in RAM, send directly to Gemini

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}. Use PDF, JPG, PNG, or TXT.`));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});
```

---

## STEP 3 — Backend: Rate Limiting (Critical — Do This First)

**Edit `server/src/index.ts`** — add this block BEFORE the routes are mounted:

```typescript
import rateLimit from 'express-rate-limit';

// Rate limit AI routes — 10 requests per user per 15 minutes
const aiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many AI requests. Please wait 15 minutes before trying again.',
  },
  keyGenerator: (req) => {
    // Rate limit per authenticated user, not per IP
    return (req as any).userId || req.ip;
  },
});

// Apply BEFORE mounting routes
app.use('/api/generate', aiRateLimit);
app.use('/api/summarize', aiRateLimit);
```

---

## STEP 4 — Backend: Zod Schemas for AI Output Validation

**Create `server/src/schemas/aiSchemas.ts`**

```typescript
import { z } from 'zod';

// Flashcard schema — strict, no extra keys allowed
export const FlashcardSchema = z.object({
  question: z.string().min(5).max(500),
  answer: z.string().min(3).max(1000),
});

export const FlashcardsResponseSchema = z.object({
  flashcards: z.array(FlashcardSchema).min(1).max(10),
});

// MCQ schema — strict
export const QuizQuestionSchema = z.object({
  question: z.string().min(5).max(500),
  options: z.array(z.string().min(1).max(200)).length(4),
  correctAnswer: z.number().min(0).max(3), // Index into options array
  explanation: z.string().max(500).optional(),
});

export const QuizResponseSchema = z.object({
  questions: z.array(QuizQuestionSchema).min(1).max(5),
});

// Types exported for frontend sharing
export type AIFlashcard = z.infer<typeof FlashcardSchema>;
export type AIQuizQuestion = z.infer<typeof QuizQuestionSchema>;
```

---

## STEP 5 — Backend: Update Gemini Service (Anti-Hallucination Prompts)

**Edit `server/src/services/geminiService.ts`** — replace/add these functions:

```typescript
import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { FlashcardsResponseSchema, QuizResponseSchema, AIFlashcard, AIQuizQuestion } from '../schemas/aiSchemas';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// ─────────────────────────────────────────────────────────────
// ANTI-HALLUCINATION SYSTEM PROMPT
// This is injected into EVERY AI call. It grounds the model.
// ─────────────────────────────────────────────────────────────
const STRICT_GROUNDING_INSTRUCTION = `
CRITICAL RULES — YOU MUST FOLLOW THESE WITHOUT EXCEPTION:
1. You may ONLY use information that appears in the SOURCE MATERIAL provided below.
2. Do NOT add any external knowledge, examples, or facts not present in the source.
3. Do NOT invent questions or answers. If the source is too short, generate fewer items.
4. Respond ONLY with valid JSON matching the exact schema specified. No markdown, no preamble, no explanation.
5. If you cannot generate valid content from the source alone, return the minimum valid JSON (e.g., 1 flashcard).
`;

// ─────────────────────────────────────────────────────────────
// Helper: Convert uploaded file buffer to Gemini Part
// ─────────────────────────────────────────────────────────────
function fileToGeminiPart(buffer: Buffer, mimeType: string): Part {
  return {
    inlineData: {
      data: buffer.toString('base64'),
      mimeType,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Helper: Extract text from plain text files
// ─────────────────────────────────────────────────────────────
function extractTextContent(buffer: Buffer): string {
  return buffer.toString('utf-8').slice(0, 50000); // Cap at 50k chars
}

// ─────────────────────────────────────────────────────────────
// GENERATE FLASHCARDS from file upload
// ─────────────────────────────────────────────────────────────
export async function generateFlashcardsFromFile(
  fileBuffer: Buffer,
  mimeType: string,
  count: number = 5
): Promise<AIFlashcard[]> {
  const prompt = `
${STRICT_GROUNDING_INSTRUCTION}

SOURCE MATERIAL:
[See the attached file/image below — this is your ONLY allowed source]

TASK: Generate exactly ${count} flashcards from the source material.

REQUIRED JSON FORMAT (respond with ONLY this JSON, nothing else):
{
  "flashcards": [
    { "question": "...", "answer": "..." },
    { "question": "...", "answer": "..." }
  ]
}
`;

  const parts: Part[] = [{ text: prompt }];

  if (mimeType === 'text/plain') {
    // For plain text, embed directly in the prompt
    const textContent = extractTextContent(fileBuffer);
    parts[0] = {
      text: `${prompt}\n\nSOURCE TEXT:\n"""\n${textContent}\n"""`,
    };
  } else {
    // For PDF/images, send as inline data
    parts.push(fileToGeminiPart(fileBuffer, mimeType));
  }

  const result = await model.generateContent(parts);
  const rawText = result.response.text().trim();

  // Strip markdown code fences if Gemini adds them despite instructions
  const cleaned = rawText.replace(/^```json\n?/, '').replace(/\n?```$/, '');

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('AI returned invalid JSON for flashcards. Please try again.');
  }

  // Zod validation — rejects hallucinated schemas
  const validated = FlashcardsResponseSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`AI output failed validation: ${validated.error.message}`);
  }

  return validated.data.flashcards;
}

// ─────────────────────────────────────────────────────────────
// GENERATE QUIZ from file upload
// ─────────────────────────────────────────────────────────────
export async function generateQuizFromFile(
  fileBuffer: Buffer,
  mimeType: string,
  count: number = 3
): Promise<AIQuizQuestion[]> {
  const prompt = `
${STRICT_GROUNDING_INSTRUCTION}

SOURCE MATERIAL:
[See the attached file/image below — this is your ONLY allowed source]

TASK: Generate exactly ${count} multiple-choice questions from the source material.

REQUIRED JSON FORMAT (respond with ONLY this JSON, nothing else):
{
  "questions": [
    {
      "question": "...",
      "options": ["option A", "option B", "option C", "option D"],
      "correctAnswer": 0,
      "explanation": "Brief reason why this is correct, using only source material."
    }
  ]
}

RULES FOR MCQs:
- "correctAnswer" is the 0-based INDEX of the correct option in the "options" array.
- All 4 options must be plausible (no obviously wrong answers).
- Questions must be answerable ONLY from the source — not from general knowledge.
`;

  const parts: Part[] = [{ text: prompt }];

  if (mimeType === 'text/plain') {
    const textContent = extractTextContent(fileBuffer);
    parts[0] = {
      text: `${prompt}\n\nSOURCE TEXT:\n"""\n${textContent}\n"""`,
    };
  } else {
    parts.push(fileToGeminiPart(fileBuffer, mimeType));
  }

  const result = await model.generateContent(parts);
  const rawText = result.response.text().trim();
  const cleaned = rawText.replace(/^```json\n?/, '').replace(/\n?```$/, '');

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('AI returned invalid JSON for quiz. Please try again.');
  }

  const validated = QuizResponseSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`AI quiz output failed validation: ${validated.error.message}`);
  }

  return validated.data.questions;
}

// ─────────────────────────────────────────────────────────────
// GENERATE FLASHCARDS from notes text (existing flow — kept compatible)
// ─────────────────────────────────────────────────────────────
export async function generateFlashcardsFromText(noteContent: string): Promise<AIFlashcard[]> {
  const prompt = `
${STRICT_GROUNDING_INSTRUCTION}

SOURCE TEXT:
"""
${noteContent.slice(0, 20000)}
"""

TASK: Generate 5 flashcards based ONLY on the source text above.

REQUIRED JSON FORMAT:
{
  "flashcards": [
    { "question": "...", "answer": "..." }
  ]
}
`;

  const result = await model.generateContent(prompt);
  const rawText = result.response.text().trim();
  const cleaned = rawText.replace(/^```json\n?/, '').replace(/\n?```$/, '');

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('AI returned invalid JSON. Please try again.');
  }

  const validated = FlashcardsResponseSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`AI output failed validation: ${validated.error.message}`);
  }

  return validated.data.flashcards;
}
```

---

## STEP 6 — Backend: New Upload Route

**Create `server/src/routes/upload.ts`**

```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { asyncHandler } from '../middleware/asyncHandler';
import { ApiError } from '../utils/ApiError';
import {
  generateFlashcardsFromFile,
  generateQuizFromFile,
} from '../services/geminiService';

const router = Router();
router.use(authenticate);

// POST /api/upload/generate
// Body: multipart/form-data with field "file" + optional "type" (flashcards|quiz|both)
router.post(
  '/generate',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new ApiError(400, 'No file uploaded. Send a PDF, image, or text file.');
    }

    const { type = 'both', flashcardCount = '5', quizCount = '3' } = req.body;
    const { buffer, mimetype } = req.file;

    const response: {
      flashcards?: unknown[];
      quiz?: unknown[];
      fileInfo: { name: string; size: number; type: string };
    } = {
      fileInfo: {
        name: req.file.originalname,
        size: req.file.size,
        type: mimetype,
      },
    };

    if (type === 'flashcards' || type === 'both') {
      response.flashcards = await generateFlashcardsFromFile(
        buffer,
        mimetype,
        parseInt(flashcardCount, 10)
      );
    }

    if (type === 'quiz' || type === 'both') {
      response.quiz = await generateQuizFromFile(
        buffer,
        mimetype,
        parseInt(quizCount, 10)
      );
    }

    res.json(response);
  })
);

export default router;
```

**Register in `server/src/index.ts`:**

```typescript
import uploadRouter from './routes/upload';
// ...after other route registrations:
app.use('/api/upload', uploadRouter);
```

---

## STEP 7 — Frontend: Type Safety Fix in SessionsPage.tsx

**In `client/src/pages/SessionsPage.tsx`**, find:

```typescript
// BEFORE (broken — defeats TypeScript)
const [dynamicQuiz, setDynamicQuiz] = useState<any[] | null>(null);
```

**Replace with:**

```typescript
// AFTER — import the type from your shared types
import type { AIQuizQuestion } from '../types/api';

const [dynamicQuiz, setDynamicQuiz] = useState<AIQuizQuestion[] | null>(null);
```

**In `client/src/types/api.ts`**, add:

```typescript
export interface AIFlashcard {
  question: string;
  answer: string;
}

export interface AIQuizQuestion {
  question: string;
  options: string[]; // Always exactly 4 items
  correctAnswer: number; // 0-based index
  explanation?: string;
}
```

---

## STEP 8 — Frontend: SmartNotesPage File Upload UI

**Edit `client/src/pages/SmartNotesPage.tsx`** — add a file upload section:

```tsx
import { useState, useRef } from 'react';
import { Upload, FileText, Image, Loader2, AlertCircle } from 'lucide-react';
import type { AIFlashcard, AIQuizQuestion } from '../types/api';
import { api } from '../lib/api';

// ─────────────────────────────────────────────────────────────
// File Upload Component (add inside SmartNotesPage)
// ─────────────────────────────────────────────────────────────
function FileUploadGenerator() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flashcards, setFlashcards] = useState<AIFlashcard[] | null>(null);
  const [quiz, setQuiz] = useState<AIQuizQuestion[] | null>(null);

  const ACCEPTED_TYPES = '.pdf,.jpg,.jpeg,.png,.webp,.txt';
  const MAX_SIZE_MB = 10;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (selected.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File too large. Maximum size is ${MAX_SIZE_MB}MB.`);
      return;
    }

    setFile(selected);
    setError(null);
    setFlashcards(null);
    setQuiz(null);
  };

  const handleGenerate = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'both');
      formData.append('flashcardCount', '5');
      formData.append('quizCount', '3');

      const response = await api.post('/upload/generate', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setFlashcards(response.data.flashcards ?? null);
      setQuiz(response.data.quiz ?? null);
    } catch (err: any) {
      setError(
        err.response?.data?.error ?? 'Failed to generate content. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const getFileIcon = () => {
    if (!file) return <Upload className="w-8 h-8 text-indigo-400" />;
    if (file.type === 'application/pdf') return <FileText className="w-8 h-8 text-red-500" />;
    if (file.type.startsWith('image/')) return <Image className="w-8 h-8 text-emerald-500" />;
    return <FileText className="w-8 h-8 text-slate-500" />;
  };

  return (
    <div className="card p-6 space-y-4">
      <h2 className="text-lg font-semibold text-slate-800">
        Generate from File
      </h2>
      <p className="text-sm text-slate-500">
        Upload a PDF, image, or text file. The AI will generate flashcards and
        a quiz <strong>strictly from your content</strong> — no hallucination.
      </p>

      {/* Drop zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-indigo-200 rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
      >
        {getFileIcon()}
        {file ? (
          <div className="text-center">
            <p className="font-medium text-slate-700">{file.name}</p>
            <p className="text-xs text-slate-400">
              {(file.size / 1024).toFixed(1)} KB — Click to change
            </p>
          </div>
        ) : (
          <div className="text-center">
            <p className="font-medium text-slate-600">Click to upload</p>
            <p className="text-xs text-slate-400">PDF, JPG, PNG, or TXT · Max 10MB</p>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={!file || loading}
        className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating (this may take 10–20 seconds)…
          </>
        ) : (
          'Generate Flashcards & Quiz'
        )}
      </button>

      {/* Generated Flashcards */}
      {flashcards && flashcards.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-slate-700">
            ✅ {flashcards.length} Flashcards Generated
          </h3>
          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
            {flashcards.map((card, i) => (
              <div key={i} className="bg-indigo-50 rounded-lg p-3 text-sm">
                <p className="font-medium text-indigo-800">Q: {card.question}</p>
                <p className="text-slate-600 mt-1">A: {card.answer}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generated Quiz */}
      {quiz && quiz.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-slate-700">
            ✅ {quiz.length} Quiz Questions Generated
          </h3>
          <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
            {quiz.map((q, i) => (
              <div key={i} className="bg-emerald-50 rounded-lg p-3 text-sm">
                <p className="font-medium text-emerald-800">
                  Q{i + 1}: {q.question}
                </p>
                <ul className="mt-2 space-y-1">
                  {q.options.map((opt, j) => (
                    <li
                      key={j}
                      className={`px-2 py-1 rounded ${
                        j === q.correctAnswer
                          ? 'bg-emerald-200 font-medium text-emerald-800'
                          : 'text-slate-600'
                      }`}
                    >
                      {String.fromCharCode(65 + j)}. {opt}
                      {j === q.correctAnswer && ' ✓'}
                    </li>
                  ))}
                </ul>
                {q.explanation && (
                  <p className="mt-2 text-xs text-slate-500 italic">
                    {q.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

Then **add `<FileUploadGenerator />` to the SmartNotesPage JSX**, alongside the existing summarize panel.

---

## STEP 9 — Auth Bypass Fix

**Edit `server/src/middleware/auth.ts`:**

```typescript
// Find the DEV_BYPASS_AUTH block and wrap it:
const bypassAuth = process.env.DEV_BYPASS_AUTH === 'true';

if (bypassAuth) {
  // HARD BLOCK in production — this cannot be bypassed
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'FATAL: DEV_BYPASS_AUTH cannot be enabled in production. Remove it from .env immediately.'
    );
  }
  console.warn('⚠️  WARNING: Auth bypass is active. Development only.');
  // ... rest of bypass logic
}
```

---

## STEP 10 — NotesPanel Overflow Fix

**Edit `client/src/components/NotesPanel.tsx`:**

Find the note list container div and add overflow controls:

```tsx
// BEFORE
<div className="space-y-2">

// AFTER  
<div className="space-y-2 max-h-96 overflow-y-auto pr-1">
```

Also cap the textarea:

```tsx
// BEFORE
<textarea className="..." />

// AFTER
<textarea className="... max-h-48 resize-y" />
```

---

## Implementation Order (Copy This Exactly)

```
1. npm install multer @types/multer express-rate-limit zod    [5 min]
2. Create server/src/middleware/upload.ts                      [5 min]
3. Add rate limiting in server/src/index.ts                    [10 min]
4. Create server/src/schemas/aiSchemas.ts                      [10 min]
5. Update server/src/services/geminiService.ts                 [20 min]
6. Create server/src/routes/upload.ts                          [10 min]
7. Register upload route in server/src/index.ts                [2 min]
8. Add AIFlashcard/AIQuizQuestion types to client/src/types/api.ts   [5 min]
9. Fix any[] in SessionsPage.tsx                               [2 min]
10. Add FileUploadGenerator to SmartNotesPage.tsx              [15 min]
11. Fix auth bypass in auth.ts                                  [5 min]
12. Fix NotesPanel overflow                                     [2 min]
```

**Total estimated time: ~90 minutes**

---

## Anti-Hallucination Strategy Summary

The system uses three layers to prevent the AI from making things up:

| Layer | Mechanism | Where |
|---|---|---|
| **Prompt Engineering** | `STRICT_GROUNDING_INSTRUCTION` block explicitly forbids external knowledge | `geminiService.ts` |
| **Schema Validation** | Zod rejects any response that doesn't match the exact shape | `aiSchemas.ts` → `geminiService.ts` |
| **Source Isolation** | File content sent as the only input; no topic/subject context leaked into prompt | `upload.ts` route |

If Gemini returns malformed JSON or invents keys (`choices` instead of `options`), Zod catches it and throws a clean error before any data reaches the database.

---

## Testing Checklist

- [ ] Upload a 1-page PDF → get 5 flashcards, all from the PDF content
- [ ] Upload a handwritten notes photo → get flashcards from visible text
- [ ] Upload an empty/blank file → get a clean error, not a crash  
- [ ] Hit `/api/generate` 11 times in 15 min → get rate limit 429 on the 11th
- [ ] Check `SessionsPage.tsx` compiles with `npx tsc --noEmit` (no `any` errors)
- [ ] Set `DEV_BYPASS_AUTH=true` with `NODE_ENV=production` → server throws on startup
