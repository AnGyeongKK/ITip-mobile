import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Phase = 'COLLECTING' | 'UPLOADING';
export const itemKey = (batchId: string, itemId: string) => `${batchId}:${itemId}`;

interface CollectState {
  phases: Record<string, Phase>;
  batchId: string | null;
  blocked: boolean;
  hydrated: boolean;
  allowedBatches: string[];
  backgroundError: string | null;
  rememberBatch: (batchId: string) => void;
  allowBatch: (batchId: string) => void;
  requireResume: (batchId: string) => void;
  pauseCollections: () => void;
  finishHydration: () => void;
  setPhase: (key: string, phase: Phase | null) => void;
}

export const useCollectStore = create<CollectState>()(persist((set) => ({
  phases: {},
  batchId: null,
  blocked: false,
  hydrated: false,
  allowedBatches: [],
  backgroundError: null,
  rememberBatch: (batchId) => set({ batchId }),
  // 이미 시작된 수집은 유지하고, 복구된 배치에는 새 권한을 추가하지 않는다.
  requireResume: (batchId) => set({ batchId }),
  allowBatch: (batchId) => set((s) => ({
    blocked: false,
    allowedBatches: s.allowedBatches.includes(batchId) ? s.allowedBatches : [...s.allowedBatches, batchId],
  })),
  pauseCollections: () => set({ blocked: true, allowedBatches: [] }),
  finishHydration: () => set({ hydrated: true }),
  setPhase: (key, phase) =>
    set((s) => {
      const phases = { ...s.phases };
      if (phase) phases[key] = phase;
      else delete phases[key];
      return { phases };
    }),
}), {
  name: 'itip-analysis-progress',
  storage: createJSONStorage(() => AsyncStorage),
  partialize: ({ batchId, blocked }) => ({ batchId, blocked }),
  onRehydrateStorage: (state) => () => state.finishHydration(),
}));
