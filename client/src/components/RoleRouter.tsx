/**
 * RoleRouter.tsx — Reads JWT role on login, redirects to correct portal.
 * Placed as the first component after successful login.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const ROLE_REDIRECT: Record<string, string> = {
    STUDENT: '/dashboard',
    PARENT: '/parent/dashboard',
    EDUCATOR: '/sessions',
    ADVISOR: '/advisor/dashboard',
    HOD: '/hod/dashboard',
    ADMIN: '/admin/dashboard',
};

interface RoleRouterProps {
    role: string | null;
}

export function RoleRouter({ role }: RoleRouterProps) {
    const navigate = useNavigate();

    useEffect(() => {
        if (!role) return;
        const target = ROLE_REDIRECT[role] ?? '/dashboard';
        navigate(target, { replace: true });
    }, [role, navigate]);

    return null;
}
