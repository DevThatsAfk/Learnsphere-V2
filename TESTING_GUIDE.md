# LearnSphere v2 — Manual Testing Guide

> **Servers must be running before testing.**
> ```
> cd server && npm run dev      # Backend → http://localhost:3001
> cd client && npm run dev      # Frontend → http://localhost:5173
> ```

---

## 0. Prerequisites — Seed the Database

Run this once before any testing. Skip if already seeded.

```bash
cd server
npx ts-node --esm src/seeds/v2TestSeed.ts
```

**What it creates:**
- 2 departments: Computer Science, Electronics Engineering
- 10 students with seeded risk data (2 RED, 3 AMBER, 4 GREEN, 1 recovering)
- HODs, Educators, Advisors, Parents, Admin — all pre-linked

---

## 1. Login & Role Routing

Open `http://localhost:5173/login`

| Account | Email | Password | Expected redirect |
|---------|-------|----------|-------------------|
| Admin | `admin@learnsphere.test` | `Admin@123` | `/admin/dashboard` |
| HoD CS | `hod.cs@learnsphere.test` | `Hod@12345` | `/hod/dashboard` |
| HoD EE | `hod.ee@learnsphere.test` | `Hod@12345` | `/hod/dashboard` |
| Educator | `edu.priya@learnsphere.test` | `Edu@12345` | `/educator/dashboard` |
| Advisor CS | `advisor.cs@learnsphere.test` | `Adv@12345` | `/advisor/dashboard` |
| Parent | `parent.aryan@learnsphere.test` | `Parent@123` | `/parent/dashboard` |
| Student RED | `student.red1@learnsphere.test` | `Student@123` | `/dashboard` |
| Student GREEN | `student.green1@learnsphere.test` | `Student@123` | `/dashboard` |

**Verify for each login:**
- [ ] Correct page loads (not the student dashboard for non-students)
- [ ] Sidebar shows role-specific nav items only
- [ ] Colored role badge in sidebar shows role name + email
- [ ] No console errors

---

## 2. Admin Dashboard — `/admin/dashboard`

Log in as `admin@learnsphere.test`.

### Tab 1 — System Health
- [ ] Total users shows correct count (≈ 29 after demo cleanup)
- [ ] RED Risk count > 0 (should be 2)
- [ ] Pending interventions count visible
- [ ] Department list shows "Computer Science" and "Electronics Engineering"

### Tab 2 — Users
- [ ] User table loads with paginated rows
- [ ] Role badge colored per role (ADMIN = purple, HOD = indigo, STUDENT = green, etc.)
- [ ] Search by email filters results in real-time
- [ ] Role dropdown filter works
- [ ] **Add User**: click `+ Add User`, fill email/password/role → user appears in table
- [ ] **Delete User**: click Delete on a test user → confirm dialog → removed from table
- [ ] Pagination: Next → Prev buttons work

### Tab 3 — Audit Log
- [ ] At least 6 entries visible
- [ ] Actions color-coded: `user.create` = green, `user.delete` = red, others = blue
- [ ] "Performed by" column shows admin email
- [ ] Timestamps are human-readable

### Tab 4 — Bulk Import
- [ ] CSV upload UI renders with drag-drop area
- [ ] Create a CSV file `test_import.csv` with at minimum:
  ```
  email,password,role,department
  bulktest1@learnsphere.test,Test@12345,STUDENT,Computer Science
  bulktest2@learnsphere.test,Test@12345,EDUCATOR,Electronics Engineering
  ```
- [ ] Upload → click "Start Import"
- [ ] Import log shows "✅ 2 users created"
- [ ] Switch to Users tab — new users appear

---

## 3. HoD Dashboard — `/hod/dashboard`

Log in as `hod.cs@learnsphere.test`.

### Tab 1 — Student Overview
- [ ] Shows only CS students (not EE)
- [ ] At-risk students (RED/AMBER) listed with score badge
- [ ] On-track (GREEN) students not shown (or shown separately)

### Tab 2 — Subject Heatmap
- [ ] Bar chart renders with subject names on X-axis
- [ ] Table below shows: Subject, Total, Avg%, <40, <50
- [ ] RED bars for subjects with high failure rates

### Tab 3 — Approval Queue
- [ ] Pending interventions listed (if any exist)
- [ ] Each card shows: student email, educator name, created date
- [ ] Click `Approve / Modify` → modal opens with text area
- [ ] Type a modified plan → click "Modify & Send" → intervention removed from queue
- [ ] Click `Dismiss` → intervention dismissed

**Also test HoD EE** (`hod.ee@learnsphere.test`):
- [ ] Only shows EE students — no CS data visible (scope enforcement)

---

## 4. Educator Dashboard — `/educator/dashboard`

Log in as `edu.priya@learnsphere.test`.

- [ ] Cohort view loads with student risk list
- [ ] Can see RED and AMBER students
- [ ] **Create Intervention**: select a RED student → click "Create Intervention" → submit educator note
  - Status should show `PENDING_REVIEW`
- [ ] Pending interventions list shows the new entry
- [ ] AI draft toggle (if enabled) generates an initial plan

---

## 5. Advisor Dashboard — `/advisor/dashboard`

Log in as `advisor.cs@learnsphere.test`.

- [ ] Student list loads — shows assigned CS students only (6 students)
- [ ] Each student card shows risk level badge
- [ ] Click a student → detail view with risk breakdown
- [ ] **Scope check**: manually navigate to `/advisor/students/<EE_student_id>` → should return 403 or error

Log in as `advisor.ee@learnsphere.test`:
- [ ] Shows only 2 EE students (amber3, green3)

---

## 6. Parent Portal — `/parent/dashboard`

Log in as `parent.aryan@learnsphere.test`.

- [ ] "My Children" panel shows Aryan Patel
- [ ] Risk badge shows 🔴 RED with score
- [ ] Red alert banner visible at top (active risk alert)
- [ ] "View Full Report" button visible
- [ ] "💬 Message Advisor" button visible

---

## 7. Student Dashboard — Risk + v1 Features

Log in as `student.red1@learnsphere.test` (Aryan — RED risk).

### A — Dashboard
- [ ] Dashboard loads at `/dashboard`
- [ ] Sidebar shows: Dashboard, My Risk Score, Study Sessions, Revision Queue, Subjects, Tasks, Exams, Smart Notes

### B — Risk Score (`/risk`)
- [ ] Score displays as **~77.2** with RED badge
- [ ] 6 risk flags visible (LOW_ATTENDANCE, LOW_MARKS, etc.)
- [ ] AI explanation text references actual numbers ("77.2/100...")
- [ ] "Recalculate" button works → same or updated score
- [ ] Intervention inbox shows approved interventions (if HOD already approved one)

### C — Study Sessions (`/sessions`)
1. Select a subject from dropdown
2. Enter a topic (e.g. "Arrays")
3. Click **Study** or **Revision** type
4. Click **Start Timed Session** → timer appears
5. Wait 10 seconds → enter `1` in active minutes field → click **End Session**
6. **Debrief screen appears** → two buttons: "🧠 Start Debrief" and "Skip → Reflection"
7. Click "Start Debrief":
   - [ ] Flashcard creation form appears
   - [ ] Add a card (Q: "What is an array?" / A: "Contiguous memory...") → saved
   - [ ] Rate card: WEAK / MODERATE / STRONG → updates
   - [ ] "Generate AI Cards" → if notes exist, AI cards added
   - [ ] Click "Proceed to Quiz"
8. Quiz phase:
   - [ ] 3 self-assessment questions appear
   - [ ] AI quiz section (if notes exist) shows dynamic MCQs
   - [ ] Answers selectable → click "Proceed to Reflection"
9. Reflection:
   - [ ] Text area for reflection
   - [ ] Tags field (comma separated)
   - [ ] Click "Save & Finish" → returns to idle
10. **"Or jump to Revision Queue →"** (visible when Revision type selected):
    - [ ] Click → lands on `/reviews` with subject pre-selected

### D — Revision Queue (`/reviews`)
- [ ] Queue shows review items by subject
- [ ] Click "Practice" on an item → flashcard practice mode
- [ ] Flip cards → rate WEAK/MODERATE/STRONG
- [ ] After last card → completion screen

### E — Subjects (`/subjects`)
- [ ] Subject list loads
- [ ] Add new subject → appears in list
- [ ] Delete subject → removed

### F — Tasks (`/tasks`)
- [ ] Task list loads
- [ ] Create task with subject + title + checklist items
- [ ] Check off checklist items → progress bar updates
- [ ] Mark task complete → moves to completed section

### G — Exams & Marks (`/exams`)
- [ ] Upcoming exams listed
- [ ] Create new exam (title + date)
- [ ] Log marks for a subject → score saved
- [ ] Analytics section shows average marks

### H — Smart Notes (`/summarize`)
- [ ] Upload a text/PDF file → summary generated
- [ ] Notes panel visible during sessions
- [ ] "Generate Flashcards from Notes" → AI creates cards

---

## 8. Student GREEN — Verify Different View

Log in as `student.green1@learnsphere.test` (Ananya — GREEN).

- [ ] Risk score shows **~10.1** with GREEN badge
- [ ] No risk flags (or minimal flags)
- [ ] AI explanation is positive/encouraging
- [ ] Intervention inbox is empty
- [ ] Same v1 features available as RED student

---

## 9. Cross-Role Interaction Flows

### Flow A — Full Intervention Pipeline
1. Log in as **student.red1** → note the student's risk score
2. Log in as **edu.priya** → create an intervention for `student.red1` with a note
3. Log in as **hod.cs** → go to Approval Queue → approve with a modified plan
4. Log in as **student.red1** → go to `/risk` → check intervention inbox → message should appear

### Flow B — Risk Improves After Study
1. Log in as **student.red1**
2. Complete a ~30-min study session
3. Click "Recalculate" on Risk page
4. Score should be equal or slightly lower (improved)

### Flow C — Scope Enforcement
1. Log in as **advisor.cs**
2. Find the ID of an EE student (from `/advisor/students` — amber3 is EE)
3. Manually visit `/advisor/dashboard` and try to access an EE student
4. Should get "Student not assigned to you" error or 403

---

## 10. Analytics & Dashboard Analytics

Log in as **student.green1**:
- [ ] `/dashboard` shows study time, sessions count, exams average
- [ ] After completing a session, values update on next visit

---

## 11. Chat & WebSocket (Manual — 2 tabs needed)

1. Open two browser tabs
2. Tab 1: Log in as `student.red1`
3. Tab 2: Log in as `advisor.cs`
4. Both navigate to the chat section (sidebar or `/parent/chat` for parents)
5. Send a message from Tab 1 → appears in Tab 2 in real-time
6. [ ] Messages persist on page reload

---

## 12. NAAC PDF Report

Log in as **hod.cs**:
- In the HoD portal, look for "NAAC Report" button (or navigate to `/hod/reports/naac`)
- Click "Download PDF"
- [ ] PDF downloads (not a blank/empty file)
- [ ] PDF contains department name, risk summary, subject data

---

## 13. Sign Out

From any dashboard:
- [ ] Click "Sign out" in sidebar
- [ ] Redirected to `/login`
- [ ] Navigating to `/dashboard` redirects back to `/login` (not accessible without auth)
- [ ] localStorage cleared (no token/role/email in DevTools → Application → Local Storage)

---

## Quick Reference — All Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@learnsphere.test` | `Admin@123` |
| HoD CS | `hod.cs@learnsphere.test` | `Hod@12345` |
| HoD EE | `hod.ee@learnsphere.test` | `Hod@12345` |
| Educator | `edu.priya@learnsphere.test` | `Edu@12345` |
| Educator 2 | `edu.ravi@learnsphere.test` | `Edu@12345` |
| Advisor CS | `advisor.cs@learnsphere.test` | `Adv@12345` |
| Advisor EE | `advisor.ee@learnsphere.test` | `Adv@12345` |
| Parent (Aryan) | `parent.aryan@learnsphere.test` | `Parent@123` |
| Parent (Rohit) | `parent.rohit@learnsphere.test` | `Parent@123` |
| Student RED | `student.red1@learnsphere.test` | `Student@123` |
| Student RED 2 | `student.red2@learnsphere.test` | `Student@123` |
| Student AMBER | `student.amber1@learnsphere.test` | `Student@123` |
| Student GREEN | `student.green1@learnsphere.test` | `Student@123` |

---

## Things That Need a Real Browser (Not Automated)

- WebSocket chat (needs 2 simultaneous tabs)
- NAAC PDF download
- File uploads (CSV import, Smart Notes PDF)
- Session timer (needs real wait time)
