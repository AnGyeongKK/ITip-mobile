import { Icon } from '@/components/ui';
import { colors } from '@/theme/tokens';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** 회색 바탕(#F6F8FA) 화면용 껍데기: 뒤로가기 + 프로필 헤더. 재생목록 선택·분석 완료 목록 디자인이 쓴다. */
export function GrayScreen({ children, onBack }: { children: React.ReactNode; onBack?: () => void }) {
  const goBack = onBack ?? (() => (router.canGoBack() ? router.back() : router.navigate('/')));
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <View style={s.header}>
        <Pressable hitSlop={12} onPress={goBack} accessibilityLabel="뒤로 가기" style={s.iconBox}>
          <Icon source={require('../../assets/icons/back.svg')} width={19} height={18} />
        </Pressable>
        <View style={s.iconBox} accessibilityLabel="프로필">
          <Icon source={require('../../assets/icons/profile.svg')} width={15.8} height={16.8} />
        </View>
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  iconBox: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
});