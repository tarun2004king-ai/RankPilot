import { createContext, useState, type ReactNode, useContext, useEffect, useCallback } from "react";
import axios, { isAxiosError } from "axios";
import type { AxiosInstance } from "axios";

interface User {
    id: string;
    name: string;
    email: string;
    plan: string;
    analysisCount?: number;
}

interface AppContextType {
    user: User | null;
    token: string | null;
    loading: boolean;
    api: AxiosInstance;
    login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
    register: (name: string, email: string, password: string) => Promise<{ success: boolean; message?: string }>;
    logout: () => void;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem("token") || null);
    const [loading, setLoading] = useState(true);

    // Create the axios instance once, not on every render
    const [api] = useState<AxiosInstance>(() => {
        const instance = axios.create({
            baseURL: BACKEND_URL,
        });

        // Update the authorization header whenever the token changes
        instance.interceptors.request.use((config) => {
            const storedToken = localStorage.getItem("token");
            if (storedToken) {
                config.headers.Authorization = `Bearer ${storedToken}`;
            }
            return config;
        });

        return instance;
    });

    const loadUser = useCallback(async () => {
        if (!token) {
            setLoading(false);
            return;
        }

        try {
            const { data } = await api.get("/api/auth/user");
            if (data.success) {
                setUser(data.user);
            }
        } catch {
            localStorage.removeItem("token");
            setToken(null);
            setUser(null);
        }
        setLoading(false);
    }, [token, api]);

    useEffect(() => {
        void loadUser();
    }, [loadUser]);

    const login = async (email: string, password: string) => {
        try {
            const res = await axios.post(`${BACKEND_URL}/api/auth/login`, { email, password });
            if (res.data.success) {
                localStorage.setItem("token", res.data.token);
                setToken(res.data.token);
                setUser(res.data.user);
                return { success: true };
            }
            return { success: false, message: res.data.message };
        } catch (error: unknown) {
            const message = isAxiosError(error)
                ? error.response?.data?.message
                : undefined;
            return {
                success: false,
                message: message || "An error occurred during login.",
            };
        }
    };

    const register = async (name: string, email: string, password: string) => {
        try {
            const res = await axios.post(`${BACKEND_URL}/api/auth/register`, { name, email, password });
            if (res.data.success) {
                localStorage.setItem("token", res.data.token);
                setToken(res.data.token);
                setUser(res.data.user);
                return { success: true };
            }
            return { success: false, message: res.data.message };
        } catch (error: unknown) {
            const message = isAxiosError(error)
                ? error.response?.data?.message
                : undefined;
            return {
                success: false,
                message: message || "An error occurred during registration.",
            };
        }
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem("token");
    };

    const value = { user, token, loading, api, login, register, logout };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// This hook intentionally lives with the provider because it is coupled to AppContext.
// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error("useApp must be used within an AppProvider");
    }
    return context;
}
