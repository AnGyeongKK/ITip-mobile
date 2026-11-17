// 공통 상단바(☰ 또는 ‹ · 프로필) + NAV-DRAWER + 우측 하단 'ITip Agent' 버튼
// 피그마 '디자인 확정 화면'(11/11) 기준. 화면마다 <AppScreen>으로 감싸 쓴다.
import { router, usePathname } from 'expo-router';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from './ui';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, radius, space, typography } from '../theme/tokens';

type NavItem = { label: string; href?: string; indent?: boolean; disabledNote?: string };

const NAV: NavItem[][] = [
  [
    { label: '홈', href: '/' },
    { label: '내 아카이브' },
    { label: '분석 기록', href: '/archive/records', indent: true },
    { label: '폴더', href: '/archive/folders', indent: true },
    { label: '키워드', href: '/archive/keywords', indent: true },
    { label: 'ITip Agent', href: '/agent' },
  ],
  [{ label: '요금제 / 구독', disabledNote: '시연 이후' }],
  [
    { label: '알림 설정', disabledNote: '시연 이후' },
    { label: '계정 설정', disabledNote: '시연 이후' },
  ],
];

export function NavDrawer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const path = usePathname();
  const insets = useSafeAreaInsets();
  const go = (href?: string) => {
    if (!href) return;
    onClose();
    router.navigate(href as never);
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.drawerBackdrop}>
        <View style={[styles.drawer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.drawerHead}>
            <View style={styles.logo} />
            <Pressable hitSlop={12} onPress={onClose} accessibilityLabel="메뉴 닫기"><Text style={{ fontSize: 18, color: colors.icon }}>✕</Text></Pressable>
          </View>
          <View style={styles.profile}>
            <View style={styles.avatar} />
            <Text style={[font.h3, { flex: 1, marginLeft: space.sm }]}>시연 사용자</Text>
            <View style={styles.planBadge}><Text style={[typography.button12, { color: colors.primaryDeep }]}>Free</Text></View>
          </View>
          {NAV.map((group, gi) => (
            <View key={gi} style={[gi > 0 && styles.groupDivider]}>
              {group.map((item) => {
                const active = item.href && (item.href === '/' ? path === '/' : path.startsWith(item.href));
                return (
                  <Pressable
                    key={item.label}
                    onPress={() => go(item.href)}
                    disabled={!item.href}
                    style={[styles.navItem, item.indent && { paddingLeft: space.xxl + space.md }, active && styles.navActive]}
                  >
                    <Text style={[item.indent ? typography.body14Medium : typography.subtitle16Semibold, active && { color: colors.primaryStrong }, item.disabledNote && { color: colors.textMuted }]}>{item.label}</Text>
                    {item.disabledNote ? <Text style={font.caption}>{item.disabledNote}</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
          <View style={{ flex: 1 }} />
          <View style={styles.planBox}><Text style={font.h3}>Free 플랜</Text></View>
        </View>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </View>
    </Modal>
  );
}

/** back=true면 왼쪽에 뒤로가기(결과·구간 상세 디자인), 아니면 메뉴(☰) */
export function AppHeader({ back, onBack }: { back?: boolean; onBack?: () => void }) {
  const [open, setOpen] = useState(false);
  const goBack = onBack ?? (() => (router.canGoBack() ? router.back() : router.navigate('/')));
  return (
    <>
      <View style={styles.header}>
        {back ? (
          <Pressable hitSlop={12} onPress={goBack} accessibilityLabel="뒤로 가기" style={styles.iconBox}>
            <Icon source={require('../../assets/icons/back.svg')} width={19} height={18} />
          </Pressable>
        ) : (
          <Pressable hitSlop={12} onPress={() => setOpen(true)} accessibilityLabel="메뉴 열기" style={styles.iconBox}>
            <Text style={styles.menuIcon}>☰</Text>
          </Pressable>
        )}
        <View style={styles.iconBox} accessibilityLabel="프로필">
          <Icon source={require('../../assets/icons/profile.svg')} width={15.8} height={16.8} />
        </View>
      </View>
      <NavDrawer visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** extended: 'ITip Agent' 글자가 들어간 넓은 버튼 (결과 > 상세 내용 디자인) */
export function AgentFab({ onPress, extended }: { onPress: () => void; extended?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.fab, extended && styles.fabExtended, pressed && { opacity: 0.8 }]} accessibilityLabel="ITip Agent 열기">
      {extended ? (
        <>
          <Text style={[typography.heading18, { color: colors.onPrimary }]}>ITip Agent</Text>
          <Icon source={require('../../assets/icons/agent-ai.svg')} width={20} height={20} />
        </>
      ) : (
        <Icon source={require('../../assets/icons/agent-fab.svg')} width={27} height={27} />
      )}
    </Pressable>
  );
}

/** 상단바 + 본문 + (선택) Agent 버튼 */
export function AppScreen({ children, onAgent, back, onBack, agentExtended }: { children: React.ReactNode; onAgent?: () => void; back?: boolean; onBack?: () => void; agentExtended?: boolean }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <AppHeader back={back} onBack={onBack} />
      <View style={{ flex: 1 }}>{children}</View>
      {onAgent ? <AgentFab onPress={onAgent} extended={agentExtended} /> : null}
    </SafeAreaView>
  );
}

/** 내 아카이브 > 분석 기록 같은 경로 표시 + 뒤로 */
export function Breadcrumb({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress ?? (() => router.back())} hitSlop={8} style={{ alignSelf: 'flex-start' }}>
      <Text style={font.caption}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, backgroundColor: colors.bg },
  iconBox: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  menuIcon: { fontSize: 20, lineHeight: 24, color: colors.icon },
  logo: { width: 96, height: 30, backgroundColor: colors.surfaceStrong, borderRadius: 2 },
  fab: { position: 'absolute', right: space.lg, bottom: space.lg, width: 56, height: 56, borderRadius: 100, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', boxShadow: `0px 4px 5px ${colors.fabShadow}` },
  fabExtended: { width: undefined, height: undefined, flexDirection: 'row', gap: 4, paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: 20 },
  drawerBackdrop: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(13,29,40,0.4)' },
  drawer: { width: '82%', backgroundColor: colors.bg, paddingHorizontal: space.lg },
  drawerHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: space.md },
  profile: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.md, marginBottom: space.sm },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceStrong },
  planBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm, backgroundColor: colors.primarySoft },
  groupDivider: { borderTopWidth: 1, borderTopColor: colors.divider, marginTop: space.sm, paddingTop: space.sm },
  navItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: space.md, paddingHorizontal: space.md, borderRadius: radius.md },
  navActive: { backgroundColor: colors.primarySoft },
  planBox: { padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, marginBottom: space.lg },
});
