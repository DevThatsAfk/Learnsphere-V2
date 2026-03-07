/**
 * AuthContext — provides login/register/logout and current user state.
 * Token + role persisted in localStorage. All API calls pick up the token
 * automatically via the axios interceptor in lib/api.ts.
 */
import {
    createContext,
    useContext,
    useState,
    useCallback,
    type ReactNode,
} from 'react';
import { authApi, TOKEN_KEY } from '../lib/api';

const ROLE_KEY = 'ls_role';
const EMAIL_KEY = 'ls_email';

interface AuthUser {
    id: string;
    token: string;
    role: string;
    email: string;
}

interface AuthContextValue {
    user: AuthUser | null;
    isAuthenticated: boolean;
    role: string | null;
    email: string | null;
    token: string | null;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ID_KEY = 'ls_uid';

function getStoredUser(): AuthUser | null {
    const token = localStorage.getItem(TOKEN_KEY);
    const role = localStorage.getItem(ROLE_KEY);
    const email = localStorage.getItem(EMAIL_KEY);
    const id = localStorage.getItem(ID_KEY);
    if (!token) return null;
    return { id: id ?? '', token, role: role ?? 'STUDENT', email: email ?? '' };
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(getStoredUser);

    const persist = (id: string, token: string, role: string, email: string) => {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(ROLE_KEY, role);
        localStorage.setItem(EMAIL_KEY, email);
        localStorage.setItem(ID_KEY, id);
        setUser({ id, token, role, email });
    };

    const login = useCallback(async (email: string, password: string) => {
        const res = await authApi.login(email, password);
        persist(res.id ?? '', res.token, res.role ?? 'STUDENT', res.email ?? email);
    }, []);

    const register = useCallback(async (email: string, password: string) => {
        const res = await authApi.register(email, password);
        persist(res.id ?? '', res.token, res.role ?? 'STUDENT', res.email ?? email);
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(ROLE_KEY);
        localStorage.removeItem(EMAIL_KEY);
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated: !!user,
            role: user?.role ?? null,
            email: user?.email ?? null,
            token: user?.token ?? null,
            login,
            register,
            logout,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
    return ctx;
}
