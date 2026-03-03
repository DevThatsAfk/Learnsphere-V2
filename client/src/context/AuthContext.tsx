/**
 * AuthContext — provides login/register/logout and current user state.
 * Token is persisted in localStorage. All API calls pick it up automatically
 * via the axios interceptor in lib/api.ts.
 */
import {
    createContext,
    useContext,
    useState,
    useCallback,
    type ReactNode,
} from 'react';
import { authApi, TOKEN_KEY } from '../lib/api';

interface AuthUser {
    token: string;
}

interface AuthContextValue {
    user: AuthUser | null;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getStoredToken(): AuthUser | null {
    const token = localStorage.getItem(TOKEN_KEY);
    return token ? { token } : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(getStoredToken);

    const login = useCallback(async (email: string, password: string) => {
        const { token } = await authApi.login(email, password);
        localStorage.setItem(TOKEN_KEY, token);
        setUser({ token });
    }, []);

    const register = useCallback(async (email: string, password: string) => {
        const { token } = await authApi.register(email, password);
        localStorage.setItem(TOKEN_KEY, token);
        setUser({ token });
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
    return ctx;
}
