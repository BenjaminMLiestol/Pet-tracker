// src/context/AuthContext.tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch, registerUnauthorizedHandler } from '../api/client';
import { unregisterFromPush } from '../api/push';
import { refreshSession, resetSessionRefresh } from '../api/session';
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
  // Tell me when a co-owner feeds or walks the dog (server push). Missing on older profiles = on.
  notify_co_owners?: boolean;
  // Language of server-written pushes: 'nb' | 'en'.
  locale?: string;
};

export const DEFAULT_FEEDING_REMINDER = '18:00';
export const DEFAULT_WALK_REMINDER = '19:00';

export function reminderTimes(user: User | null) {
  return {
    feeding: user?.feeding_reminder_time ?? DEFAULT_FEEDING_REMINDER,
    walk: user?.walk_reminder_time ?? DEFAULT_WALK_REMINDER,
  };
}

export type RegisterInput = {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
};

type SettingsPatch = Partial<
  Pick<User, 'feeding_reminder_time' | 'walk_reminder_time' | 'notify_co_owners' | 'locale'>
>;

type AuthState = {
  user: User | null;
  token: string | null;
  isBootstrapping: boolean;
  login: (email: string, password: string) => Promise<void>;
  // Creates an account and signs in. Throws an error whose message is safe to show.
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  // Signs out every phone and session of this account.
  logoutEverywhere: () => Promise<boolean>;
  // Saves personal settings. Optimistic; resolves true when the server accepted them.
  updateSettings: (patch: SettingsPatch) => Promise<boolean>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isBootstrapping, setBootstrapping] = useState(true);

  // Local sign-out: reset state first so nothing re-persists, then wipe the previous
  // user's cached data. Never talks to the server (the login may already be dead).
  const endSession = useCallback(async () => {
    setToken(null);
    setUser(null);
    await Promise.all([clearToken(), AsyncStorage.removeItem('authUser'), clearUserCache()]);
  }, []);

  const logout = useCallback(async () => {
    try {
      if (token) {
        await unregisterFromPush();
        await apiFetch('/auth/logout', { method: 'POST' });
      }
    } catch {
      // ignore network errors on logout
    } finally {
      await endSession();
    }
  }, [token, endSession]);

  // Resolves true when every session was revoked. Offline or failed: stay signed in, so the
  // person knows it didn't happen.
  const logoutEverywhere = useCallback(async () => {
    try {
      await unregisterFromPush();
      await apiFetch('/auth/logout-all', { method: 'POST' });
    } catch {
      return false;
    }
    await endSession();
    return true;
  }, [endSession]);

  // An expired or revoked login (any 401) ends the session locally. It must not call
  // /auth/logout: that would 401 too and loop.
  useEffect(() => {
    registerUnauthorizedHandler(() => {
      endSession();
    });
  }, [endSession]);

  // Persist before updating state: setting the token triggers data fetches that read it from storage.
  const signIn = useCallback(async (res: { user: User; token: string }) => {
    await saveToken(res.token);
    await AsyncStorage.setItem('authUser', JSON.stringify(res.user));
    setUser(res.user);
    setToken(res.token);
    resetSessionRefresh();
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiFetch<{ user: User; token: string }>('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      await signIn(res);
    },
    [signIn]
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const res = await apiFetch<{ user: User; token: string }>('/auth/register', {
        method: 'POST',
        body: input,
      });
      await signIn(res);
    },
    [signIn]
  );

  // Takes a refreshed profile into state and the saved copy.
  const adopt = useCallback((me: User | null) => {
    if (!me) return;
    setUser(me);
    AsyncStorage.setItem('authUser', JSON.stringify(me)).catch(() => {});
  }, []);

  // Coming back to the foreground after a while renews the login too.
  useEffect(() => {
    if (!token) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refreshSession<User>().then(adopt);
    });
    return () => sub.remove();
  }, [token, adopt]);

  // Bootstrap from storage
  useEffect(() => {
    (async () => {
      try {
        const [token, userStr] = await Promise.all([getToken(), AsyncStorage.getItem('authUser')]);
        if (token && userStr) {
          setToken(token);
          setUser(JSON.parse(userStr) as User);
          // Swap in a fresh week-long login and pick up settings changed on another device.
          // A 401 here (expired login) signs out.
          refreshSession<User>({ force: true }).then(adopt);
        }
      } finally {
        setBootstrapping(false);
      }
    })();
  }, []);

  const updateSettings = useCallback(
    async (patch: SettingsPatch): Promise<boolean> => {
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
    () => ({ user, token, isBootstrapping, login, register, logout, logoutEverywhere, updateSettings }),
    [user, token, isBootstrapping, login, register, logout, logoutEverywhere, updateSettings]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
