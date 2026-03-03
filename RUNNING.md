# Running LearnSphere

Follow these steps to set up and run the LearnSphere application locally.

## 📋 Prerequisites
- **Node.js** (v18 or higher recommended)
- **PostgreSQL** (Active instance)
- **npm** (comes with Node.js)

---

## 🚀 1. Backend Setup

1. **Navigate to the server directory:**
   ```bash
   cd server
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the `server/` root with the following:
   ```env
   PORT=3001
   DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/learnsphere?schema=public"
   JWT_SECRET="your_fallback_secret_key"
   DEV_BYPASS_AUTH=false
   ```
   *Replace `USER`, `PASSWORD`, and `5432` with your actual PostgreSQL credentials.*

4. **Initialize Database:**
   Run the migrations to create your tables:
   ```bash
   npx prisma migrate dev --name init
   ```

5. **Start the API Server:**
   ```bash
   npm run dev
   ```
   The backend will start at `http://localhost:3001`.

---

## 💻 2. Frontend Setup

1. **Navigate to the client directory:**
   ```bash
   cd ../client
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the `client/` root:
   ```env
   VITE_API_URL=http://localhost:3001/api
   ```

4. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   The frontend will start at `http://localhost:5173`.

---

## 🛠️ Common Commands

| Task | Command | Directory |
|---|---|---|
| Reset Database | `npx prisma migrate reset` | `server/` |
| View DB Studio | `npx prisma studio` | `server/` |
| Build for Production | `npm run build` | `client/` |
| Run Type Checks | `npx tsc --noEmit` | `client/` or `server/` |

---

## ✅ Verification
Once both servers are running:
1. Open your browser to `http://localhost:5173`.
2. You should be redirected to the **Login** page.
3. Create an account and start adding subjects to verify database connectivity.
