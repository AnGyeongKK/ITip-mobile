// 로그인 목업 상태. 실제 Google 로그인·서버 인증은 없다 (시연용).
// 저장하지 않으므로 앱을 새로 켤 때마다 로그인 목업부터 보인다.
import { create } from 'zustand';

type MockAuthState = {
  signedIn: boolean;
  signIn: () => void;
  signOut: () => void;
};

export const useMockAuth = create<MockAuthState>((set) => ({
  signedIn: false,
  signIn: () => set({ signedIn: true }),
  signOut: () => set({ signedIn: false }),
}));