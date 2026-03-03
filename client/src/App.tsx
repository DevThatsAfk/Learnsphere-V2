import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { RequireAuth } from './components/RequireAuth';

// Pages (lazy-like stubs — will be filled in subsequent modules)
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { SubjectsPage } from './pages/SubjectsPage';
import { TasksPage } from './pages/TasksPage';
import { SessionsPage } from './pages/SessionsPage';
import { ExamsPage } from './pages/ExamsPage';
import { ReviewsPage } from './pages/ReviewsPage';
import { SmartNotesPage } from './pages/SmartNotesPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected — all wrapped in RequireAuth → AppShell */}
          <Route element={<RequireAuth />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/subjects" element={<SubjectsPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/sessions" element={<SessionsPage />} />
            <Route path="/exams" element={<ExamsPage />} />
            <Route path="/reviews" element={<ReviewsPage />} />
            <Route path="/summarize" element={<SmartNotesPage />} />
          </Route>

          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
