import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** '분석이 끝났어요' 목록에서 보러 가기를 누른 영상. 서버가 열람 여부를 주지 않아서 기기에 저장한다. 키: `${batchId}:${itemId}` */
interface ViewedState {
  viewed: string[];
  mark: (key: string) => void;
}

export const useViewedStore = create<ViewedState>()(persist((set) => ({
  viewed: [],
  mark: (key) => set((s) => (s.viewed.includes(key) ? s : { viewed: [...s.viewed, key] })),
}), {
  name: 'itip-viewed-results',
  storage: createJSONStorage(() => AsyncStorage),
}));