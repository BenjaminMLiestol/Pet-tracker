// src/context/AuthContext.tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch, registerUnauthorizedHandler } from '../api/client';
import { clearUserCache } from '../api/userCache';
import { clearToken, getToken, setToken as saveToken } from '../api/tokenStorage';

type User = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  // When this person wants to be reminded, 24h "HH:MM". Missing on profiles saved
  // before these settings existed; see reminderTimes().
  feeding_reminder_time?: string;
  walk_reminder_time?: string;
};

export const DEFAULT_FEEDING_REMINDER = '18:00';
export const DEFAULT_WALK_REMINDER = '19:00';

export function reminderTimes(user: User | null) {
  return {
    feeding: user?.feeding_reminder_time ?? DEFAULT_FEEDING_REMINDER,
    walk: user?.walk_reminder_time ?? DEFAULT_WALK_REMINDER,
  };
}

type ReminderTimePatch = Partial<Pick<User, 'feeding_reminder_time' | 'walk_reminder_time'>>;

type AuthState = {
  user: User | null;
  token: string | null;
  isBootstrapping: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  // Saves personal settings. Optimistic; resolves true when the server accepted them.
  updateReminderTimes: (patch: ReminderTimePatch) => Promise<boolean>;
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
      // Reset state first so nothing re-persists, then wipe the previous user's cached data.
      setToken(null);
      setUser(null);
      await Promise.all([clearToken(), AsyncStorage.removeItem('authUser'), clearUserCache()]);
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
    // Persist before updating state: setting the token triggers data fetches that read it from storage.
    await saveToken(res.token);
    await AsyncStorage.setItem('authUser', JSON.stringify(res.user));
    setUser(res.user);
    setToken(res.token);
  }, []);

  // Bootstrap from storage
  useEffect(() => {
    (async () => {
      try {
        const [token, userStr] = await Promise.all([getToken(), AsyncStorage.getItem('authUser')]);
        if (token && userStr) {
          setToken(token);
          setUser(JSON.parse(userStr) as User);
          // Quietly refresh the profile: picks up settings changed on another device (and
          // fills in fields older saved profiles lack). A 401 here logs out an expired login.
          apiFetch<User>('/auth/me')
            .then((me) => {
              setUser(me);
              return AsyncStorage.setItem('authUser', JSON.stringify(me));
            })
            .catch(() => {});
        }
      } finally {
        setBootstrapping(false);
      }
    })();
  }, []);

  const updateReminderTimes = useCallback(
    async (patch: ReminderTimePatch): Promise<boolean> => {
      const before = user;
      setUser((u) => (u ? { ...u, ...patch } : u));
      try {
        const saved = await apiFetch<User>('/auth/me', { method: 'PATCH', body: patch });
        setUser(saved);
        await AsyncStorage.setItem('authUser', JSON.stringify(saved)).catch(() => {});
        return true;
      } catch {
        setUser(before);
        return false;
      }
    },
    [user]
  );

  const value = useMemo(
    () => ({ user, token, isBootstrapping, login, logout, updateReminderTimes }),
    [user, token, isBootstrapping, login, logout, updateReminderTimes]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
