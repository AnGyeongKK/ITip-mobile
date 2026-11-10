import { create } from 'zustand';

export type Phase = 'COLLECTING' | 'UPLOADING';
export const itemKey = (batchId: string, itemId: string) => `${batchId}:${itemId}`;

interface CollectState {
  phases: Record<string, Phase>;
  setPhase: (key: string, phase: Phase | null) => void;
}

export const useCollectStore = create<CollectState>((set) => ({
  phases: {},
  setPhase: (key, phase) =>
    set((s) => {
      const phases = { ...s.phases };
      if (phase) phases[key] = phase;
      else delete phases[key];
      return { phases };
    }),
}));