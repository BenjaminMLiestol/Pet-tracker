import React, { createContext, useContext, useMemo, ReactNode, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type FeedingRecord = {
  timestamp: number; // unix ms
  fed: boolean; // true if fed, false if skipped/not fed
};

export type BathRecord = {
  timestamp: number; // unix ms
};

export type WalkRecord = {
  timestamp: number; // unix ms
  walked: boolean;
};

export type WeightRecord = {
  timestamp: number; // unix ms
  weightKg: number;
};

export type PetContextValue = {
  name: string;
  breed: string;
  feedings: FeedingRecord[];
  baths: BathRecord[];
  walks: WalkRecord[];
  weights: WeightRecord[];
  hasFedToday: boolean;
  hasWalkedToday: boolean;
  lastBathAt: Date | null;
  currentWeightKg: number | null;
  setFedToday: (fed: boolean) => void;
  setBathedToday: () => void;
  setWalkedToday: (walked: boolean) => void;
  nextBathDueAt: Date | null;
  isBathDueToday: boolean;
  setWeightToday: (weightKg: number) => void;
};

const PetContext = createContext<PetContextValue | undefined>(undefined);

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getLatestTimestamp<T extends { timestamp: number }>(items: T[]): number | null {
  if (items.length === 0) return null;
  let max = items[0].timestamp;
  for (let i = 1; i < items.length; i += 1) {
    if (items[i].timestamp > max) max = items[i].timestamp;
  }
  return max;
}

export function PetProvider({ children }: { children: ReactNode }) {
  const now = Date.now();

  // Seed data for demo purposes; in a real app this would come from storage or API
  const [feedings, setFeedings] = useState<FeedingRecord[]>([
    { timestamp: now - 1000 * 60 * 60 * 2, fed: true }, // 2 hours ago (today)
    { timestamp: now - 1000 * 60 * 60 * 26, fed: true }, // yesterday
  ]);
  const [baths, setBaths] = useState<BathRecord[]>([
    { timestamp: now - 1000 * 60 * 60 * 24 * 10 }, // 10 days ago
    { timestamp: now - 1000 * 60 * 60 * 24 * 40 }, // ~1 month + 10 days ago
  ]);
  const [walks, setWalks] = useState<WalkRecord[]>([
    { timestamp: now - 1000 * 60 * 60 * 3, walked: true }, // 3 hours ago (today)
    { timestamp: now - 1000 * 60 * 60 * 28, walked: true }, // yesterday
  ]);
  const [weights, setWeights] = useState<WeightRecord[]>([
    { timestamp: now - 1000 * 60 * 60 * 24 * 30, weightKg: 18.9 },
    { timestamp: now - 1000 * 60 * 60 * 24 * 7, weightKg: 19.2 },
    { timestamp: now - 1000 * 60 * 60 * 1, weightKg: 19.1 }, // latest
  ]);

  const STORAGE_KEY = 'pet-tracker/state/v1';

  // Load persisted state on mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<{
          feedings: FeedingRecord[];
          baths: BathRecord[];
          walks: WalkRecord[];
          weights: WeightRecord[];
        }>;
        if (!isMounted) return;
        if (Array.isArray(parsed.feedings)) setFeedings(parsed.feedings);
        if (Array.isArray(parsed.baths)) setBaths(parsed.baths);
        if (Array.isArray(parsed.walks)) setWalks(parsed.walks);
        if (Array.isArray(parsed.weights)) setWeights(parsed.weights);
      } catch (err) {
        // Ignore malformed storage; keep seed data
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Persist state whenever it changes
  useEffect(() => {
    const state = JSON.stringify({ feedings, baths, walks, weights });
    AsyncStorage.setItem(STORAGE_KEY, state).catch(() => {
      // Non-fatal if persistence fails
    });
  }, [feedings, baths, walks, weights]);

  const setFedToday = useCallback((fed: boolean) => {
    setFeedings((prev) => {
      const today = new Date();
      const idx = prev.findIndex((r) => isSameDay(new Date(r.timestamp), today));
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], fed, timestamp: Date.now() };
        return next;
      }
      return [{ timestamp: Date.now(), fed }, ...prev];
    });
  }, []);

  const setBathedToday = useCallback(() => {
    setBaths((prev) => {
      const today = new Date();
      const idx = prev.findIndex((r) => isSameDay(new Date(r.timestamp), today));
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], timestamp: Date.now() };
        return next;
      }
      return [{ timestamp: Date.now() }, ...prev];
    });
  }, []);

  const setWalkedToday = useCallback((walked: boolean) => {
    setWalks((prev) => {
      const today = new Date();
      const idx = prev.findIndex((r) => isSameDay(new Date(r.timestamp), today));
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], walked, timestamp: Date.now() };
        return next;
      }
      return [{ timestamp: Date.now(), walked }, ...prev];
    });
  }, []);

  const setWeightToday = useCallback((weightKg: number) => {
    if (!Number.isFinite(weightKg) || weightKg <= 0) return;
    setWeights((prev) => {
      // Always append a new entry instead of updating today's existing record
      return [{ timestamp: Date.now(), weightKg }, ...prev];
    });
  }, []);

  const value = useMemo<PetContextValue>(() => {
    const today = new Date();
    const hasFedToday = feedings.some(
      (f) => f.fed && isSameDay(new Date(f.timestamp), today)
    );

    const hasWalkedToday = walks.some(
      (w) => w.walked && isSameDay(new Date(w.timestamp), today)
    );

    const lastBathTs = getLatestTimestamp(baths);
    const lastBathAt = lastBathTs ? new Date(lastBathTs) : null;

    // Monthly schedule: 30 days after last bath; if none, schedule today
    const monthMs = 1000 * 60 * 60 * 24 * 30;
    const nextBathDueAt = lastBathAt ? new Date(lastBathAt.getTime() + monthMs) : today;
    const isBathDueToday = nextBathDueAt ? isSameDay(today, nextBathDueAt) : false;

    const latestWeightTs = getLatestTimestamp(weights);
    const currentWeightKg = latestWeightTs
      ? weights.find((w) => w.timestamp === latestWeightTs)?.weightKg ?? null
      : null;

    return {
      name: 'Toya',
      breed: 'Finnish Lapphund',
      feedings,
      baths,
      walks,
      weights,
      hasFedToday,
      hasWalkedToday,
      lastBathAt,
      currentWeightKg,
      setFedToday,
      setBathedToday,
      setWalkedToday,
      nextBathDueAt,
      isBathDueToday,
      setWeightToday,
    };
  }, [baths, feedings, walks, weights, setFedToday]);

  return <PetContext.Provider value={value}>{children}</PetContext.Provider>;
}

export function usePet(): PetContextValue {
  const ctx = useContext(PetContext);
  if (!ctx) {
    throw new Error('usePet must be used within a PetProvider');
  }
  return ctx;
}
