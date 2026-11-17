// 시작 화면(피그마 '시작화면'): 파란 바탕 + 흰 로고 + 문구. 앱이 열린 직후 잠시 보이고 사라진다.
// 시스템 스플래시는 로고만 그릴 수 있어서 문구는 이 앱 안 화면이 맡는다.
import { colors, typography } from '@/theme/tokens';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';

// 앱 화면이 준비될 때까지 시스템 스플래시를 붙잡아 둔다(모듈이 불러와질 때 한 번).
void SplashScreen.preventAutoHideAsync().catch(() => {});

const SHOW_MS = 1200;
const FADE_MS = 300;

export function SplashOverlay() {
  const [visible, setVisible] = useState(true);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => {}); // 이 화면이 그려졌으니 시스템 스플래시를 걷는다
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(() => setVisible(false));
    }, SHOW_MS);
    return () => clearTimeout(timer);
  }, [opacity]);

  if (!visible) return null;
  return (
    <Animated.View style={[s.root, { opacity }]}>
      <View style={s.center}>
        <Image source={require('../../assets/images/splash-logo.png')} style={s.logo} resizeMode="contain" />
      </View>
      <Text style={s.text}>나중에 볼 영상,{'\n'}함께 분석해볼까요?</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.primary, zIndex: 100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 62.75, height: 65.25 }, // 디자인 로고 58.8×61.2 + 여백
  // 로고 중심에서 아래로 (로고 절반 30.6 + 간격 24)
  text: { ...typography.heading22, color: colors.onPrimary, textAlign: 'center', position: 'absolute', left: 0, right: 0, top: '50%', marginTop: 55 },
});