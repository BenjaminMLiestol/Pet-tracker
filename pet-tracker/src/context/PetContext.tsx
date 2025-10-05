import React, { createContext, useContext, useMemo, ReactNode, useState, useCallback } from 'react';

export type FeedingRecord = {
  timestamp: number; // unix ms
  fed: boolean; // true if fed, false if skipped/not fed
};

export type BathRecord = {
  timestamp: number; // unix ms
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
  weights: WeightRecord[];
  hasFedToday: boolean;
  lastBathAt: Date | null;
  currentWeightKg: number | null;
  setFedToday: (fed: boolean) => void;
  setBathedToday: () => void;
  nextBathDueAt: Date | null;
  isBathDueToday: boolean;
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
  const weights: WeightRecord[] = [
    { timestamp: now - 1000 * 60 * 60 * 24 * 30, weightKg: 18.9 },
    { timestamp: now - 1000 * 60 * 60 * 24 * 7, weightKg: 19.2 },
    { timestamp: now - 1000 * 60 * 60 * 1, weightKg: 19.1 }, // latest
  ];

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

  const value = useMemo<PetContextValue>(() => {
    const today = new Date();
    const hasFedToday = feedings.some(
      (f) => f.fed && isSameDay(new Date(f.timestamp), today)
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
      weights,
      hasFedToday,
      lastBathAt,
      currentWeightKg,
      setFedToday,
      setBathedToday,
      nextBathDueAt,
      isBathDueToday,
    };
  }, [baths, feedings, weights, setFedToday]);

  return <PetContext.Provider value={value}>{children}</PetContext.Provider>;
}

export function usePet(): PetContextValue {
  const ctx = useContext(PetContext);
  if (!ctx) {
    throw new Error('usePet must be used within a PetProvider');
  }
  return ctx;
}
