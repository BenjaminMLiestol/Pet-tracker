// src/context/AuthContext.tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch, registerUnauthorizedHandler } from '../api/client';

type User = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  // add more if your backend returns them
};

type AuthState = {
  user: User | null;
  token: string | null;
  isBootstrapping: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isBootstrapping, setBootstrapping] = useState(true);

  const logout = useCallback(async () => {
    try {
      if (token) {
        await apiFetch('/auth/logout', { method: 'POST' });
      }
    } catch {
      // ignore network errors on logout
    } finally {
      await AsyncStorage.multiRemove(['authToken', 'authUser']);
      setToken(null);
      setUser(null);
    }
  }, [token]);

  // if any request gets 401, force logout
  useEffect(() => {
    registerUnauthorizedHandler(() => {
      logout();
    });
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiFetch<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setUser(res.user);
    setToken(res.token);
    await AsyncStorage.setItem('authToken', res.token);
    await AsyncStorage.setItem('authUser', JSON.stringify(res.user));
  }, []);

  // Bootstrap from storage
  useEffect(() => {
    (async () => {
      try {
        const [storedToken, storedUser] = await AsyncStorage.multiGet(['authToken', 'authUser']);
        const token = storedToken[1];
        const userStr = storedUser[1];
        if (token && userStr) {
          setToken(token);
          setUser(JSON.parse(userStr) as User);
          // Optionally refresh /auth/me here to verify token.
          // const me = await apiFetch<User>('/auth/me');
          // setUser(me);
        }
      } finally {
        setBootstrapping(false);
      }
    })();
  }, []);

  const value = useMemo(
    () => ({ user, token, isBootstrapping, login, logout }),
    [user, token, isBootstrapping, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
