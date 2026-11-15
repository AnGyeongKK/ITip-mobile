// START · Google 로그인 시작 (피그마 Page 15 와이어프레임, 시연용 목업)
// 실제 Google 로그인은 하지 않는다. 버튼을 누르면 신규 사용자 흐름(약관 동의)으로 넘어간다.
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Icon } from '@/components/ui';
import { colors, space, typography } from '@/theme/tokens';

export default function LoginStart() {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.center}>
        <Icon source={require('../../../assets/icons/app-icon.svg')} width={72} height={72} />
        <Text style={[typography.heading22, { marginTop: space.lg }]}>ITip</Text>
        <Text style={[typography.body14Medium, styles.tagline]}>IT 정보성 YouTube 영상을 분석하고{'\n'}활용할 수 있게 도와주는 서비스</Text>
      </View>
      <View style={styles.bottom}>
        <Button title="Google 계정으로 계속하기" onPress={() => router.push('/login/terms' as never)} />
        <Text style={[typography.caption12, styles.note]}>시연용 화면이에요. 실제 Google 로그인은 하지 않아요.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  tagline: { marginTop: space.sm, color: colors.textSub, textAlign: 'center' },
  bottom: { paddingHorizontal: 20, paddingBottom: space.xl, gap: space.md },
  note: { color: colors.textMuted, textAlign: 'center' },
});
