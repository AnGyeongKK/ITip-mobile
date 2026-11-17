// AUTH-TERMS · 약관 동의 (신규 Google 사용자) — 피그마 Page 15 와이어프레임, 시연용 목업
// 필수 약관 두 개에 동의하면 '동의하고 시작하기'가 켜지고, 누르면 홈으로 간다.
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Icon } from '@/components/ui';
import { useMockAuth } from '@/features/auth/mockAuth';
import { syncPushDevice } from '@/features/notifications/pushDevice';
import { colors, radius, space, typography } from '@/theme/tokens';

type TermKey = 'service' | 'privacy' | 'data';
const TERMS: { key: TermKey; label: string; required: boolean }[] = [
  { key: 'service', label: '서비스 이용약관', required: true },
  { key: 'privacy', label: '개인정보 처리방침', required: true },
  { key: 'data', label: '서비스 개선을 위한 데이터 제공 동의', required: false },
];

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <View style={[styles.box, checked && styles.boxOn]}>
      {checked ? <Icon source={require('../../../assets/icons/check.svg')} width={16} height={12} /> : null}
    </View>
  );
}

export default function LoginTerms() {
  const signIn = useMockAuth((s) => s.signIn);
  const [agreed, setAgreed] = useState<Record<TermKey, boolean>>({ service: false, privacy: false, data: false });
  const all = TERMS.every((t) => agreed[t.key]);
  const ready = TERMS.filter((t) => t.required).every((t) => agreed[t.key]);

  const toggleAll = () => setAgreed({ service: !all, privacy: !all, data: !all });
  const toggle = (k: TermKey) => setAgreed((a) => ({ ...a, [k]: !a[k] }));
  const start = () => {
    signIn();
    // 분석 완료 알림을 받을 수 있게 시작할 때 알림 권한을 묻고 기기를 등록한다
    void syncPushDevice({ askPermission: true });
    router.replace('/');
  };
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/login' as never));

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={goBack} accessibilityLabel="뒤로 가기" style={styles.headerSide}>
          <Icon source={require('../../../assets/icons/back.svg')} width={19} height={18} />
        </Pressable>
        <Text style={typography.heading18}>약관 동의</Text>
        <View style={styles.headerSide} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[typography.subtitle16Semibold, { color: colors.textStrong }]}>서비스 이용을 위해 약관에 동의해주세요</Text>

        <View style={{ gap: space.sm }}>
          <Pressable onPress={toggleAll} style={styles.allRow} accessibilityRole="checkbox" accessibilityState={{ checked: all }}>
            <Checkbox checked={all} />
            <Text style={typography.subtitle16Bold}>전체 동의</Text>
          </Pressable>

          <View>
            {TERMS.map((t) => (
              <View key={t.key} style={styles.termRow}>
                <Pressable onPress={() => toggle(t.key)} style={styles.termMain} accessibilityRole="checkbox" accessibilityState={{ checked: agreed[t.key] }}>
                  <Checkbox checked={agreed[t.key]} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={typography.body14Medium}>{t.label}</Text>
                    <Text style={[typography.caption12, { color: t.required ? colors.primaryStrong : colors.textMuted }]}>{t.required ? '필수' : '선택'}</Text>
                  </View>
                </Pressable>
                {/* 약관 본문은 아직 없어서 안내만 띄운다 */}
                <Pressable onPress={() => Alert.alert(t.label, '약관 내용은 준비 중이에요.')} style={styles.detailBtn}>
                  <Text style={[typography.button12, { color: colors.textSub }]}>자세히 보기</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottom}>
        <Button title="동의하고 시작하기" onPress={start} disabled={!ready} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg },
  headerSide: { width: 52, height: 40, justifyContent: 'center' },
  body: { paddingHorizontal: 20, paddingTop: space.xl, gap: space.xxl },
  allRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, paddingHorizontal: space.md, borderRadius: radius.md, backgroundColor: colors.surface },
  termRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 13, paddingHorizontal: space.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  termMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md },
  box: { width: 20, height: 20, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  boxOn: { borderColor: colors.primaryStrong, backgroundColor: colors.primarySoft },
  detailBtn: { height: 26, paddingHorizontal: space.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  bottom: { paddingHorizontal: 20, paddingTop: space.xxl, paddingBottom: space.xl },
});
