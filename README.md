# LearnSphere V2

**LearnSphere** is a full-stack academic intelligence platform built for higher-education institutions. It tracks student performance across 6 risk dimensions, automates early-warning interventions, and provides role-specific dashboards for every stakeholder in the learning lifecycle.

> Live deployment: **Vercel** (frontend) + **Railway** (backend + PostgreSQL)

---

## 🏛️ Portals & Roles

| Role | Portal URL | Responsibilities |
|---|---|---|
| **Student** | `/dashboard` | Study sessions, notes, flashcards, quizzes, task tracking |
| **Educator** | `/educator/dashboard` | Class attendance, exam marks, student risk overview |
| **Advisor** | `/advisor/dashboard` | Intervention management, counselling notes, student timelines |
| **HoD** | `/hod/dashboard` | Department-wide risk heatmap, NAAC report download |
| **Admin** | `/admin/dashboard` | User management, bulk CSV import, system overview |
| **Parent** | `/parent/dashboard` | Child risk summary, full report, advisor contact |

---

## ✨ Key Features

### 🤖 AI-Powered Study Tools (Gemini 2.0 Flash)
- **Flashcard & Quiz Generation** — Generated from live typed notes or saved notes for any study session. Handles Gemini "thinking model" JSON output correctly via `extractJSON()` helper.
- **Smart Notes Booster** — Upload `.txt` / `.md` files or generate summaries from pasted content. PDF binary uploads are rejected cleanly with a helpful message.
- **Document Summarisation** — Full-text summarisation endpoint powered by Gemini with strict grounding instructions (no hallucination).
- **Anti-hallucination Grounding** — All AI endpoints enforce strict system-level instructions. Outputs validated using Zod schemas before being sent to the client.

### 📊 Risk Engine (6-Dimension Scoring)
Deterministic rule layer computes a **0–100 risk score** from real database data. Gemini writes the human-readable explanation — it never influences the score.

| Dimension | Weight | Data Source |
|---|---|---|
| Attendance | 25% | `AttendanceRecord` (last 30 days) |
| Exam Marks | 25% | `Exam` + `ExamMark` (last 90 days) |
| Study Activity | 20% | `StudySession` (last 30 days) |
| LMS Activity | 15% | `LMSActivityLog` (last 14 days) |
| Recall Strength | 10% | `ReviewItem.recallStrength` |
| Behavioural Trend | 5% | `StudySession` 15-day delta |

Risk levels: **GREEN** (0–30) · **AMBER** (31–60) · **RED** (61–100)

### 📋 Intervention Workflow
1. Risk engine flags a student as AMBER/RED
2. Educator submits intervention request
3. AI drafts an intervention plan (Gemini 2.0 Flash)
4. Advisor reviews, modifies, and sends to student
5. Student acknowledges, outcome is recorded
6. Full timeline visible from Advisor portal → Interventions tab

### 💬 Real-time Chat (Socket.IO)
- Advisor ↔ Student WebSocket chat with message history
- Typing indicators, timestamp display, avatar bubbles
- Room-scoped (`chat:{studentId}`) — messages persisted to DB

### 📄 NAAC Report
HoD portal includes a **Download NAAC Report** button that generates a client-side HTML report with department name, risk summary stats, and subject heatmap — printable as PDF.

---

## 🛠️ Tech Stack

### Frontend (`client/`)
- **Framework:** React 18 + Vite
- **Language:** TypeScript
- **Styling:** Tailwind CSS (custom indigo/purple premium theme)
- **State:** React Context (Auth, Subjects)
- **Routing:** React Router v6
- **HTTP:** Axios with JWT interceptor
- **Real-time:** socket.io-client

### Backend (`server/`)
- **Runtime:** Node.js 22 + Express
- **Language:** TypeScript
- **Database:** PostgreSQL 15 via Prisma ORM
- **Auth:** JWT (7-day expiry) + bcryptjs (12 rounds)
- **AI:** Google Generative AI SDK (`gemini-2.0-flash`)
- **File Uploads:** Multer (in-memory)
- **Real-time:** Socket.IO
- **Rate Limiting:** `express-rate-limit` (10 AI requests / 15 min)
- **Cron:** `node-cron` (7-day intervention follow-up)

---

## 🚀 Deployment

| Service | Platform | Config File |
|---|---|---|
| Frontend | Vercel | `client/vercel.json` |
| Backend | Railway | `railway.json` (root) |
| Database | Railway PostgreSQL | Managed via Railway |

**Environment variables required:**

**Railway (backend):**
```
DATABASE_URL=postgresql://...
JWT_SECRET=...
GEMINI_API_KEY=...
CLIENT_URL=https://your-vercel-app.vercel.app
PORT=8080
```

**Vercel (frontend):**
```
VITE_API_URL=https://your-railway-app.railway.app/api
```

---

## 🖥️ Local Setup

### Prerequisites
- Node.js v18+
- PostgreSQL 15
- Git

### 1. Clone & Install
```bash
git clone https://github.com/DevThatsAfk/Learnsphere-V2.git
cd Learnsphere-V2

cd server && npm install
cd ../client && npm install
```

### 2. Create `server/.env`
```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/learnsphere?schema=public"
JWT_SECRET="your-secret-key"
GEMINI_API_KEY="your-gemini-api-key"
PORT=3001
DEV_BYPASS_AUTH="false"
```

### 3. Set Up Database
```bash
cd server

# Push schema to local Postgres
npx prisma db push

# Seed with full test data (all roles, risk profiles, interventions)
npx ts-node --transpile-only src/seeds/v2TestSeed.ts
```

### 4. Run
Open two terminals:
```bash
# Terminal 1 — Backend
cd server && npm run dev

# Terminal 2 — Frontend
cd client && npm run dev
```

App runs at **http://localhost:5173**

---

## 🔑 Test Credentials (from `v2TestSeed.ts`)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@learnsphere.test` | `Admin@123` |
| HoD (CS) | `hod.cs@learnsphere.test` | `Hod@12345` |
| Educator | `edu.priya@learnsphere.test` | `Edu@12345` |
| Advisor | `advisor.cs@learnsphere.test` | `Adv@12345` |
| Student (RED risk) | `student.red1@learnsphere.test` | `Student@123` |
| Student (GREEN risk) | `student.green1@learnsphere.test` | `Student@123` |
| Parent | `parent.aryan@learnsphere.test` | `Parent@123` |

---

## 🔒 Security
- Stateless JWT authentication — no server-side sessions
- `DEV_BYPASS_AUTH` flag throws a fatal error on startup if set in production
- All AI rate limited per user (10 req / 15 min window)
- CORS locked to `CLIENT_URL` env var
- Server binds to `0.0.0.0` for Railway compatibility
- Passwords hashed with bcrypt (12 salt rounds)

---

## 📁 Project Structure
```
Learnsphere-V2/
├── client/                  # React + Vite frontend
│   ├── src/
│   │   ├── components/      # Shared UI (AppShell, ChatWidget, RiskScoreCard…)
│   │   ├── context/         # AuthContext, SubjectsContext
│   │   ├── pages/           # One file per portal page
│   │   ├── lib/             # api.ts (axios), socket.ts
│   │   └── types/           # Shared TypeScript types
│   └── vercel.json          # SPA rewrite rule
├── server/
│   ├── src/
│   │   ├── routes/          # Express routers (19 files)
│   │   ├── services/        # Business logic + AI services
│   │   ├── middleware/       # Auth, error handler, rate limiter
│   │   ├── seeds/           # adminSeed, fullSeed, v2TestSeed
│   │   ├── prisma/          # Prisma client singleton
│   │   └── socket/          # Socket.IO chat handler
│   └── prisma/
│       └── schema.prisma    # Full schema (v1 + v2 models)
└── railway.json             # Railway build + start config
```

---

*LearnSphere V2 — engineered by Keert*
