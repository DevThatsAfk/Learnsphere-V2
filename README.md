# LearnSphere 

**LearnSphere** is a premium study management and consistency tracking application designed to help users maximize learning efficiency. With built-in AI tools grounded in reality, it bridges task management, deep work learning sessions, and data analytics creating a perfect, distraction-free environment.

---

## ✨ Key Features & Phase 2 Implementations

### 🤖 AI-Powered "Smart Notes Booster" (Anti-Hallucination)
- **Local File Understanding:** Directly upload `.pdf`, `.png`, `.jpg`, `.webp`, or `.txt` content up to 10MB completely bypassing token limits directly into the AI.
- **Strict Grounding:** Powered by Gemini `1.5 flash`, the model is hard-coded with `STRICT_GROUNDING_INSTRUCTION` ensuring that all flashcards & multiple-choice quizzes are drawn 100% from your inputs.
- **Structured Output Generation:** Seamless UI integrated via `FileUploadGenerator` components creating JSON validated AI objects seamlessly via backend Zod schema enforcements. 

### 📊 Data-Driven Analytics
- **Consistency Heatmap:** Visual 30-day tracking grids covering daily study active minutes.
- **Neglect Signals:** Automated detection of subjects remaining untouched for >14 days.
- **Subject Performance tracking.** 

### ⏱️ Deep Work & Sessions
- **Live Session Timers:** Dynamic Active Session processing synced back to Postgres.
- **Infinite Overflow Safety Cap:** The UI restricts past study notes lists to maximum thresholds, preserving user layouts during prolonged study periods. 

### 📝 Task & Review System
- **Hierarchical Checklists.**
- **Spaced Review Queues.**
- **Type-Safe Ecosystem:** Utilizing full `TS` configurations enforcing payload contracts.

---

## 🛠️ Tech Stack 

**Frontend:**
- **Framework:** React 18 (Vite)
- **Language:** TypeScript
- **Styling:** Tailwind CSS (Custom Indigo/Emerald Premium Aesthetics)

**Backend:**
- **Runtime:** Node.js (Express)
- **Language:** TypeScript
- **Security:** JWT Authentication (bcrypt), `express-rate-limit` (10 AI requests / 15min / User), Hard-blocked production DEV flags.
- **Database:** PostgreSQL (Prisma ORM)
- **AI Processing:** Google Generative AI (Images, PDF, Text via buffered memory processing with `multer`)

---

## 🔒 Security Posture
- Total stateless JWT authentication mechanism.
- Enforced boundary blocks on backend developer routes (`DEV_BYPASS_AUTH` explicitly throws Fatal Errors on initial spin up if `NODE_ENV=production`, preventing silent breaches).
- Server calculated analytics rendering frontend spoofing impossible.

---

## 📜 Repository
This project represents multiple iterations of bug-squashing and AI integration.  
*Engineered by Keert | Learnsphere-V1*
