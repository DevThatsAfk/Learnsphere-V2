import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AppShell } from '../components/AppShell';
import { SubjectsProvider } from '../context/SubjectsContext';

/** Wraps protected routes. Redirects to /login if not authenticated. */
export function RequireAuth() {
    const { isAuthenticated } = useAuth();
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    return (
        // SubjectsProvider is scoped to authenticated routes only.
        // All protected pages share a single subjects fetch and mutation stream.
        <SubjectsProvider>
            <AppShell>
                <Outlet />
            </AppShell>
        </SubjectsProvider>
    );
}
