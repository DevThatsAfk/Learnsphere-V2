# LearnSphere V2 — User Guide

> **App URL:** Your Vercel deployment URL  
> **All test accounts use the credentials listed below**

---

## 🔑 Login Credentials

| Role | Email | Password |
|---|---|---|
| Admin | `admin@learnsphere.test` | `Admin@123` |
| HoD (CS Dept) | `hod.cs@learnsphere.test` | `Hod@12345` |
| HoD (EE Dept) | `hod.ee@learnsphere.test` | `Hod@12345` |
| Educator | `edu.priya@learnsphere.test` | `Edu@12345` |
| Educator | `edu.ravi@learnsphere.test` | `Edu@12345` |
| Advisor | `advisor.cs@learnsphere.test` | `Adv@12345` |
| Student (RED risk — Aryan) | `student.red1@learnsphere.test` | `Student@123` |
| Student (AMBER risk — Rohit) | `student.amber1@learnsphere.test` | `Student@123` |
| Student (GREEN risk — Ananya) | `student.green1@learnsphere.test` | `Student@123` |
| Parent (Aryan's parent) | `parent.aryan@learnsphere.test` | `Parent@123` |

---

## 👤 Student Portal

**Login as:** `student.red1@learnsphere.test` / `Student@123`

### Dashboard (`/dashboard`)
- View all your subjects and quick stats
- Click **+ Add Subject** to create a new subject (e.g. "Mathematics")
- Click on any subject card to open its study workspace

### Study Sessions (`/sessions`)
1. Select a subject from the dropdown
2. Enter a topic (optional) and click **Start Session**
3. The timer starts — use the **Notes** panel on the right to type notes while studying
4. Click **End Session** to save your active minutes

### AI Flashcards & Quiz (inside a session)
1. Type notes in the Notes panel (or load saved ones)
2. Click **✨ Generate Flashcards** — AI creates Q&A cards from your notes
3. Click **Generate Quiz** — AI creates multiple-choice questions
4. Flip flashcards by clicking on them; select quiz answers and check results

> ⚠️ Minimum ~30 characters of notes required for generation

### Smart Notes (`/notes`)
- **Paste text** into the input area → click **Summarize / Key Points / Mind Map / Exam Questions** to generate AI outputs
- **Upload a file** (.txt or .md only) to auto-fill the input area
- **Generate from File** tab — upload PDF/image for AI analysis (binary understood by Gemini)

### Tasks (`/tasks`)
- Add tasks with due dates and priority levels
- Check off completed tasks
- Tasks are subject-linked for context

### Exams (`/exams`)
- Log upcoming exams with date and subject
- After the exam, add your marks for tracking

### My Risk Score (`/risk`)
- View your current **risk score** (0–100), level badge (GREEN / AMBER / RED)
- See all 6 dimension bars: Attendance, Marks, Study Activity, LMS Activity, Recall Strength, Behavioural
- Read the **AI explanation** of your current risk profile
- Click **Recalculate Risk** to get a fresh score based on your latest data
- View any open **Interventions** sent to you by your educator or advisor

---

## 👨‍🏫 Educator Portal

**Login as:** `edu.priya@learnsphere.test` / `Edu@12345`

### Overview Tab
- See all students in your department ranked by risk level (RED → AMBER → GREEN)
- Each student card shows risk score, roll number, and top flags

### Student Detail
- Click any student card to expand their full **RiskScoreCard** with dimension breakdown
- View AI explanation and intervention history

### Attendance Tab
- Select a student and date
- Mark attendance: **Present / Absent / Late**
- Saves to database immediately — feeds the risk engine's Attendance dimension (25%)

### Exams & Marks Tab
- Add an exam for a student (title + date)
- Add marks per subject (stored as percentage)
- Feeds the risk engine's Marks dimension (25%)

### Trigger Intervention
- On a RED/AMBER student card, click **Raise Intervention**
- AI drafts an intervention plan based on the student's risk profile
- The plan goes to the HoD queue for approval before being sent to the student

---

## 🎓 Advisor Portal

**Login as:** `advisor.cs@learnsphere.test` / `Adv@12345`

### Students Tab
- See your assigned students (sorted by risk level)
- Click a student to view their full risk breakdown, dimension scores, and flags

### Interventions Tab
- View the complete **intervention timeline** for each assigned student
- Timeline shows status badges: `PENDING_REVIEW` → `APPROVED` → `ACKNOWLEDGED` → `COMPLETED`
- See AI plan, final plan, educator notes, sent/seen timestamps, and student outcomes

### Counselling Notes
- Inside a student's detail view, scroll to **Counselling Notes**
- Add private notes after a session (date + free text)
- Notes are only visible to the advisor

### Chat
- Click **💬 Chat** on any student card to open the real-time chat widget
- Type a message and press Send — student sees it in their portal
- Typing indicator shows when the other party is composing

---

## 🏛️ HoD Portal

**Login as:** `hod.cs@learnsphere.test` / `Hod@12345`

### Overview Tab
- Department-wide summary: total students, RED / AMBER / GREEN counts
- Progress bars and percentage breakdown
- Full student list with individual risk scores and roll numbers

### Heatmap Tab
- Subject-level failure analysis:
  - **Below 40%** count (critical)
  - **Below 50%** count (borderline)
  - **Average marks** per subject
- Bar chart visualisation by subject

### Interventions Queue Tab
- Approve or dismiss interventions raised by educators
- Click a pending intervention to expand it
- Edit the AI-drafted plan in the text box, then click **✅ Approve & Send**
- Or click **Dismiss** to reject without sending

### NAAC Report
- Click **📄 Download NAAC Report** (top-right)
- Opens a print window with department name, risk summary, and subject heatmap
- Use **Ctrl+P → Save as PDF** to export

---

## ⚙️ Admin Portal

**Login as:** `admin@learnsphere.test` / `Admin@123`

### Users Tab
- Search users by name/email
- Filter by role (Student, Educator, Advisor, etc.)
- Paginated list with role badge, department, roll number, and join date
- Click 🗑️ to delete a user (confirmation required)

### Create User
1. Fill in Email, Password, Role, Department
2. (For Students) also enter Roll Number, Year, Section
3. Click **Create User** — account is created immediately and appears in the list

### Bulk Import (CSV)
1. Prepare a CSV file with headers: `email,password,role,department,rollNumber,yearOfStudy,section`
2. Click **Choose File** and select the CSV
3. Click **Import** — each row is processed; a summary shows imported / skipped / failed counts
4. Download the result log to see per-row details

### Audit Logs Tab
- Paginated log of all system events (user creation, deletion, login attempts)
- Includes timestamp, actor, action type, and target

### System Health Tab
- Live status of backend services (Database, AI service, Email service)
- Shows uptime indicators

---

## 👨‍👩‍👧 Parent Portal

**Login as:** `parent.aryan@learnsphere.test` / `Parent@123`

### Child Overview
- See your linked child's name, roll number, and current risk level badge
- Risk score with colour-coded level (GREEN / AMBER / RED)

### View Full Report
- Click **📋 View Full Report** to expand an inline panel
- Shows all active risk flags with details (e.g. "Attendance 58.6% < 75% threshold")
- No navigation away — stays on the same page

### Message Advisor
- Click **💬 Message Advisor** to expand the advisor contact card
- Shows advisor name and email
- Use the **Chat** button to open the real-time chat with the advisor

---

## 💡 Tips

- **Risk scores are not live** — click "Recalculate Risk" (Student) or "Force Recalculate" (Educator/Admin) to refresh after adding attendance or marks data
- **Flashcard/Quiz generation** works best with 100+ words of notes
- **Chat** requires both server and client running simultaneously (WebSocket)
- **Parent portal** only shows children linked during seeding — use Admin portal to link more

---

*LearnSphere V2 — Full platform guide*
