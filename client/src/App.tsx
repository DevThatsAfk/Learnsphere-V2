import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { RequireAuth } from './components/RequireAuth';

// v1 Pages
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { SubjectsPage } from './pages/SubjectsPage';
import { TasksPage } from './pages/TasksPage';
import { SessionsPage } from './pages/SessionsPage';
import { ExamsPage } from './pages/ExamsPage';
import { ReviewsPage } from './pages/ReviewsPage';
import { SmartNotesPage } from './pages/SmartNotesPage';

// v2 Portal Pages
import StudentRiskPage from './pages/StudentRiskPage';
import ParentPortal from './pages/ParentPortal';
import EducatorDashboard from './pages/EducatorDashboard';
import AdvisorPortal from './pages/AdvisorPortal';
import HoDPortal from './pages/HoDPortal';
import AdminPortal from './pages/AdminPortal';

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
            {/* v2 Portal Routes */}
            <Route path="/risk" element={<StudentRiskPage />} />
            <Route path="/parent/dashboard" element={<ParentPortal />} />
            <Route path="/parent/child/:childId" element={<ParentPortal />} />
            <Route path="/parent/chat/:childId" element={<ParentPortal />} />
            <Route path="/educator/dashboard" element={<EducatorDashboard />} />
            <Route path="/advisor/dashboard" element={<AdvisorPortal />} />
            <Route path="/hod/dashboard" element={<HoDPortal />} />
            <Route path="/admin/dashboard" element={<AdminPortal />} />
          </Route>

          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
